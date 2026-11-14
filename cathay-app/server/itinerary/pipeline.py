"""The two workflows the app calls: discover (Explorer -> Curator) and plan (Scheduler -> Quality Check)."""
import logging
import re

from . import config, llm as llm_module
from .checks import day_window, flight_limits
from .curator import clean_text, curator_agent
from .explorer import explorer_agent
from .geocoding import enrich_coordinates, locate_areas
from .llm import AgentError, PlanConstraints
from .photos import attach_photos, find_place_images
from .plan import prepare_places, to_app_plan
from .places import photo_fields
from .repair import adopt_liked_food
from .reviewer import feedback_text, quality_check_agent
from .schedule import InvalidDraft, normalize_schedule, sanitize_plan_cards
from .scheduler import scheduler_agent, split_cards, trip_dates
from .travel import add_meal_transfers, transfer_estimates

log = logging.getLogger(__name__)
SOURCE_ID = re.compile(r"^S\d{1,3}$")
EXCERPT_FOR_APP = 1200  # what the app stores per source; enough for the scheduler and reviewer


def clean_sources(raw_sources) -> list[dict]:
    """Sources come back from the browser, so accept only well-formed ones with http(s) links."""
    sources, seen = [], set()
    for raw in raw_sources if isinstance(raw_sources, list) else []:
        if not isinstance(raw, dict):
            continue
        source_id, url = clean_text(raw.get("id"), 8), clean_text(raw.get("url"), 500)
        if not SOURCE_ID.match(source_id) or source_id in seen or not re.match(r"^https?://", url, re.IGNORECASE):
            continue
        seen.add(source_id)
        sources.append(
            {
                "id": source_id,
                "title": clean_text(raw.get("title"), 140) or url,
                "url": url,
                "excerpt": clean_text(raw.get("excerpt"), config.MAX_SOURCE_CHARACTERS),
            }
        )
    return sources


def _wrap(exc: Exception) -> AgentError:
    log.warning("Itinerary provider failed: %s", type(exc).__name__)
    return AgentError("The language model or web search failed. Try again.")


def run_discover(context: dict, model: str | None = None, llm=None, search=None) -> dict:
    model = model or config.default_model()
    llm = llm or llm_module.make_llm_client()
    search = search or llm_module.make_search_client()
    try:
        sources, images, search_log = explorer_agent(llm, search, model, context)
        places = curator_agent(llm, model, context, sources, images, search_client=search)
        enrich_coordinates(places, context["destination"])
    except AgentError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc) from exc
    app_sources = [{**s, "excerpt": s["excerpt"][:EXCERPT_FOR_APP]} for s in sources]
    return {"places": places, "sources": app_sources, "search_log": search_log}


def refresh_place_photos(places: list[dict], destination: str, search=None) -> list[dict]:
    """Enrich a saved deck without asking the curator to change its places or IDs."""
    search = search or llm_module.make_search_client()
    candidates = find_place_images(search, places, destination)
    matches = attach_photos([{"id": place["id"], "name": place["name"]} for place in places], candidates, [])
    return [
        {**place, **photo_fields({**place, "web_photo": match["web_photo"]})}
        for place, match in zip(places, matches)
    ]


def run_plan(context: dict, raw_cards, raw_sources, model: str | None = None, llm=None) -> dict:
    model = model or config.default_model()
    cards = sanitize_plan_cards(raw_cards)
    sources = clean_sources(raw_sources)
    liked, maybe = split_cards(cards)
    if not liked:
        liked, maybe = maybe, []  # use the places with likes when no place reached consensus
    neutral = None if liked else [card for card in cards if not card["pass_count"]]

    dates, known = trip_dates(context), {s["id"] for s in sources}
    arrival, departure = flight_limits(context.get("flights", []))
    if not any(end > start for start, end in (day_window(day, arrival, departure) for day in dates)):
        raise PlanConstraints("The group’s flights leave no shared time after the airport buffers.")

    llm = llm or llm_module.make_llm_client()
    eligible = liked + maybe if neutral is None else neutral
    transfers = transfer_estimates(eligible)
    attempts, feedback, last_problem = [], "", ""
    area_points = {}
    for attempt in range(1, config.MAX_REVIEW_ATTEMPTS + 2):
        try:
            raw = scheduler_agent(llm, model, context, liked, maybe, sources, transfers, feedback, neutral)
            schedule = adopt_liked_food(normalize_schedule(raw, dates, eligible, known, require_activity=bool(liked)), eligible, known)
            for day in schedule["days"]:
                taken = set()
                for stop in day["stops"]:
                    if stop["type"] != "meal" or stop.get("card_id"):
                        continue
                    key = f"meal-{day['date']}-{stop['meal']}"
                    while key in taken:
                        key += "x"
                    taken.add(key)
                    stop["transfer_id"] = key
            areas = {stop["area"] for day in schedule["days"] for stop in day["stops"] if "transfer_id" in stop}
            missing = sorted(areas - area_points.keys())
            resolved = locate_areas(missing, context["destination"])
            area_points.update({area: resolved.get(area) for area in missing})
            draft_transfers = add_meal_transfers(transfers, schedule, eligible, area_points)
            review = quality_check_agent(llm, model, context, schedule, eligible, sources, draft_transfers)
        except InvalidDraft as exc:
            feedback = last_problem = str(exc)
            continue
        except Exception as exc:  # noqa: BLE001
            if attempts:
                break  # a failed redraft keeps the draft we already have
            if isinstance(exc, AgentError):
                raise
            raise _wrap(exc) from exc
        review["attempts"] = attempt
        attempts.append((schedule, review, draft_transfers))
        if review["approved"]:
            break
        feedback = feedback_text(review)
    if not attempts:
        raise PlanConstraints(last_problem or "The planner could not produce a readable draft.")
    # Never block the group on a rule: show the draft with the fewest rule errors, with its issues listed.
    schedule, review, draft_transfers = min(reversed(attempts), key=lambda pair: _errors(pair[1]))
    review["attempts"] = len(attempts)
    plan = to_app_plan(schedule, prepare_places(cards), sources, review, context["destination"])
    return {"plan": {**plan, "transfers": draft_transfers}}


def _errors(review: dict) -> int:
    return sum(1 for issue in review.get("issues", []) if issue.get("severity") == "error")
