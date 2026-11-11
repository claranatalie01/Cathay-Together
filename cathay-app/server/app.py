"""Itinerary service for Cathay Together.

Run from the cathay-app folder:   python -m uvicorn server.app:app --host 127.0.0.1 --port 8000
The Vite dev server forwards /api/itinerary/* here, so the keys in .env never reach the browser.
This service has no login or rate limit: keep it on 127.0.0.1, or add both before hosting it.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .itinerary import config, pipeline
from .itinerary.llm import AgentError
from .itinerary.schemas import DiscoverRequest, PlanRequest

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("itinerary")

app = FastAPI(title="Cathay Together itinerary service", docs_url=None, redoc_url=None)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message, "fields": None})


@app.exception_handler(AgentError)
async def agent_error(_: Request, exc: AgentError):
    return _error(exc.status, exc.code, str(exc))


@app.exception_handler(RequestValidationError)
async def invalid_request(_: Request, exc: RequestValidationError):
    # The input is never echoed back; the first problem's field path is enough to debug.
    where = ".".join(str(part) for part in exc.errors()[0]["loc"][1:]) if exc.errors() else ""
    return _error(422, "validation_failed", f"The trip details were not valid{f' ({where})' if where else ''}.")


@app.exception_handler(Exception)
async def unexpected(_: Request, exc: Exception):
    log.exception("Unhandled error", exc_info=exc)
    return _error(500, "agent_failed", "The itinerary planner hit an unexpected problem. Try again.")


@app.get("/api/itinerary/health")
def health():
    return {
        "ok": True,
        "model": config.default_model(),
        "llm_key": bool(config.env("POE_API_KEY")),
        "search_key": bool(config.env("TAVILY_API_KEY")),
        "google_places": bool(config.env("GOOGLE_PLACES_API_KEY")),
    }


@app.post("/api/itinerary/discover")
def discover(body: DiscoverRequest):
    """Explorer -> Curator: search the web and return swipe cards plus the evidence they cite."""
    return pipeline.run_discover(body.context.model_dump(mode="json"), body.model)


@app.post("/api/itinerary/plan")
def plan(body: PlanRequest):
    """Scheduler -> Quality Check: build the day-by-day plan from the group's votes."""
    return pipeline.run_plan(body.context.model_dump(mode="json"), body.cards, body.sources, body.model)
