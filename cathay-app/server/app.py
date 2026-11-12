"""Authenticated shared-trip entry point for Stacia's itinerary pipeline."""
import hashlib
import logging
from datetime import datetime
from json import dumps, loads
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .itinerary import config, pipeline
from .itinerary.geocoding import enrich_coordinates
from .itinerary.llm import AgentError
from .itinerary.schemas import TripContext

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
log = logging.getLogger(__name__)


class PlannerRequest(BaseModel):
    action: Literal["discover", "plan"]
    groupId: UUID


class PlannerError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message


def error_response(status, code, message):
    return JSONResponse(status_code=status, content={"code": code, "message": message, "fields": None})


@app.exception_handler(PlannerError)
def planner_error(_: Request, exc: PlannerError):
    return error_response(exc.status, exc.code, exc.message)


@app.exception_handler(AgentError)
def provider_error(_: Request, exc: AgentError):
    return error_response(exc.status, exc.code, str(exc))


@app.exception_handler(RequestValidationError)
def invalid_request(_: Request, __: RequestValidationError):
    return error_response(422, "validation_failed", "The trip details were not valid.")


@app.exception_handler(Exception)
def unexpected(_: Request, exc: Exception):
    log.error("Trip planner failed: %s", type(exc).__name__)
    return error_response(502, "agent_failed", "The trip planner could not finish. Try again.")


def request_json(client, method, path, headers, **kwargs):
    response = client.request(method, path, headers=headers, **kwargs)
    if response.is_error:
        if response.status_code in (401, 403) and path == "/auth/v1/user":
            raise PlannerError(401, "unauthenticated", "Sign in again to prepare this trip.")
        if response.status_code == 400 and path.endswith("/get_group") and response.json().get("message") == "group_not_found":
            raise PlannerError(404, "group_not_found", "This trip is unavailable.")
        raise PlannerError(503, "planner_unavailable", "The trip planner could not reach shared trip data. Try again.")
    return response.json() if response.content else None


class TripStore:
    def __init__(self, client, authorization, group_id):
        public_key = config.env("VITE_SUPABASE_PUBLISHABLE_KEY")
        secret_key = config.env("SUPABASE_SECRET_KEY")
        if not public_key or not secret_key:
            raise PlannerError(503, "planner_unavailable", "The shared trip planner is not configured yet.")
        user_headers = {"apikey": public_key, "Authorization": authorization}
        self.client = client
        self.group_id = group_id
        self.service = {"apikey": secret_key}
        if not secret_key.startswith("sb_secret_"):
            self.service["Authorization"] = f"Bearer {secret_key}"
        self.viewer = request_json(client, "GET", "/auth/v1/user", user_headers)["id"]
        request_json(client, "POST", "/rest/v1/rpc/get_group", user_headers, json={"target_group": group_id})

    def rpc(self, name, **args):
        return request_json(self.client, "POST", f"/rest/v1/rpc/{name}", self.service,
                            json={"target_group": self.group_id, **args})

    def row(self, table, fields):
        rows = request_json(self.client, "GET", f"/rest/v1/{table}", self.service,
                            params={"group_id": f"eq.{self.group_id}", "select": fields})
        return rows[0] if rows else None

    def save_deck_places(self, token, places):
        rows = request_json(self.client, "PATCH", "/rest/v1/group_place_decks",
                            {**self.service, "Prefer": "return=representation"},
                            params={"group_id": f"eq.{self.group_id}", "job_token": f"eq.{token}",
                                    "legacy": "is.false", "select": "group_id"},
                            json={"places": places})
        if not rows:
            raise PlannerError(409, "planner_changed", "The trip changed while the planner was running. Try again.")

    def release(self, token):
        request_json(self.client, "PATCH", "/rest/v1/group_place_decks", self.service,
                     params={"group_id": f"eq.{self.group_id}", "job_token": f"eq.{token}"},
                     json={"job_token": None, "job_until": None})


def context_for(inputs):
    time_zone = ZoneInfo(inputs["time_zone"])
    travellers = {m["user_id"]: {"member": f"Traveller {i}"} for i, m in enumerate(inputs["members"], 1)}
    for flight in inputs["flights"]:
        arrival = flight["direction"] == "outbound"
        moment = datetime.fromisoformat(flight["arrive_at" if arrival else "depart_at"]).astimezone(time_zone)
        field = "arrival" if arrival else "departure"
        traveller = travellers[flight["user_id"]]
        traveller[f"{field}_date"] = moment.date().isoformat()
        traveller[f"{field}_time"] = moment.strftime("%H:%M")
    try:
        return TripContext(destination=inputs["destination"], dates={"start": inputs["start"], "end": inputs["end"]},
                           group_size=len(travellers), budget_per_person=inputs["budget"],
                           flights=list(travellers.values())).model_dump(mode="json")
    except ValueError as exc:
        raise PlannerError(422, "validation_failed", "The planner could not use this trip’s dates or traveller details.") from exc


def cards_for_plan(deck, inputs):
    places = (loads(Path(__file__).with_name("legacy_places.json").read_text(encoding="utf-8"))
              if deck["legacy"] else deck["places"])
    members = inputs["members"]
    choices = {(vote["user_id"], vote["place_id"]): vote["choice"] for vote in inputs["votes"]}
    if any(not member["preferences_saved_at"] or any((member["user_id"], p["id"]) not in choices for p in places)
           for member in members):
        raise PlannerError(422, "not_ready", "Everyone needs to save their choices before you can build the itinerary.")
    return [{**place, "total_members": len(members),
             "like_count": sum(choices[(m["user_id"], place["id"])] == "like" for m in members)} for place in places]


def plan_fingerprint(inputs) -> str:
    """What a plan was built from: who is in the group, every swipe, and every chosen flight.

    If any of these change, a saved plan is out of date and must be built again.
    """
    payload = {
        "members": sorted(m["user_id"] for m in inputs["members"]),
        "votes": sorted([v["user_id"], v["place_id"], v["choice"]] for v in inputs["votes"]),
        "flights": sorted([f["user_id"], f["direction"], f.get("depart_at"), f.get("arrive_at")] for f in inputs["flights"]),
    }
    return hashlib.sha256(dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]


def plan_is_current(store, inputs) -> bool:
    """A saved plan counts only if it was built from the group's current members, swipes and flights."""
    row = store.row("itineraries", "fingerprint:plan->>fingerprint")
    return bool(row) and row.get("fingerprint") == plan_fingerprint(inputs)


def finished(store, action, deck, inputs=None):
    if action == "discover":
        return deck and (deck["legacy"] or (
            deck["places"] and all("photoSourceUrl" in place and "coordinates" in place for place in deck["places"])
        ))
    return inputs is not None and plan_is_current(store, inputs)


def run_job(store, action):
    deck = store.row("group_place_decks", "legacy,places,sources")
    if finished(store, action, deck, store.rpc("trip_planner_inputs") if action == "plan" else None):
        return {"ready": True}
    token = str(uuid4())
    if not store.rpc("claim_trip_planner_job", viewer=store.viewer, token=token):
        raise PlannerError(409, "planner_busy", "Someone is already preparing this trip. Try again in a moment.")
    try:
        # Check again after taking the lease, in case the previous request just finished.
        deck = store.row("group_place_decks", "legacy,places,sources")
        inputs = store.rpc("trip_planner_inputs")
        if finished(store, action, deck, inputs):
            return {"ready": True}
        if not inputs or not any(m["user_id"] == store.viewer for m in inputs["members"]):
            raise PlannerError(404, "group_not_found", "This trip is unavailable.")
        if action == "discover":
            if deck and deck["places"]:
                places = deck["places"]
                if any("photoSourceUrl" not in place for place in places):
                    places = pipeline.refresh_place_photos(places, inputs["destination"])
                enrich_coordinates(places, inputs["destination"])
                store.save_deck_places(token, places)
                return {"ready": True}
            result = pipeline.run_discover(context_for(inputs))
        else:
            if not (deck and (deck["legacy"] or deck["places"])):
                raise PlannerError(422, "not_ready", "Prepare the suggestions and save everyone's choices first.")
            cards = cards_for_plan(deck, inputs)
            if not deck["legacy"] and any("coordinates" not in card for card in cards):
                places = deck["places"]
                enrich_coordinates(places, inputs["destination"])
                if all("coordinates" in place for place in places):
                    store.save_deck_places(token, places)
                    cards = cards_for_plan(deck, inputs)
            result = pipeline.run_plan(context_for(inputs), cards, deck["sources"])["plan"]
            result["builtAt"] = int(datetime.now().timestamp() * 1000)
            result["fingerprint"] = plan_fingerprint(inputs)
        if not store.rpc("finish_trip_planner_job", viewer=store.viewer, token=token, operation=action, result=result,
                         expected_inputs=inputs if action == "plan" else None):
            raise PlannerError(409, "planner_changed", "The trip changed while the planner was running. Try again.")
        return {"ready": True}
    finally:
        try:
            store.release(token)
        except (httpx.HTTPError, PlannerError):
            log.warning("The trip planner lease could not be released. It will expire automatically.")


@app.post("/api/planner")
def planner(body: PlannerRequest, authorization: str = Header(default="")):
    if not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise PlannerError(401, "unauthenticated", "Sign in to prepare this trip.")
    url = config.env("VITE_SUPABASE_URL")
    if not url:
        raise PlannerError(503, "planner_unavailable", "The shared trip planner is not configured yet.")
    with httpx.Client(base_url=url, timeout=12) as client:
        return run_job(TripStore(client, authorization, str(body.groupId)), body.action)
