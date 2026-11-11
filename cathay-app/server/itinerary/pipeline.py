"""The two workflows the app calls: discover (Explorer -> Curator) and plan (Scheduler -> Quality Check)."""
import logging
import re

from . import config, llm as llm_module
from .curator import clean_text, curator_agent
from .explorer import explorer_agent
from .llm import AgentError, NothingToPlan
from .plan import prepare_places, to_app_plan
from .reviewer import feedback_text, quality_check_agent
from .schedule import normalize_schedule, sanitize_plan_cards
from .scheduler import scheduler_agent, split_cards, trip_dates

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
    log.exception("Itinerary agent failed")
    return AgentError("The language model or web search failed. Check the keys in .env and try again.")


def run_discover(context: dict, model: str | None = None, llm=None, search=None) -> dict:
    model = model or config.default_model()
    llm = llm or llm_module.make_llm_client()
    search = search or llm_module.make_search_client()
    try:
        sources, images, search_log = explorer_agent(llm, search, model, context)
        places = curator_agent(llm, model, context, sources, images, search_client=search)
    except AgentError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _wrap(exc) from exc
    app_sources = [{**s, "excerpt": s["excerpt"][:EXCERPT_FOR_APP]} for s in sources]
    return {"places": places, "sources": app_sources, "search_log": search_log}


def _errors(review: dict) -> int:
    return sum(1 for i in review["issues"] if i["severity"] == "error")


def run_plan(context: dict, raw_cards, raw_sources, model: str | None = None, llm=None) -> dict:
    model = model or config.default_model()
    cards = sanitize_plan_cards(raw_cards)
    sources = clean_sources(raw_sources)
    liked, maybe = split_cards(cards)
    if not liked:
        liked, maybe = maybe, []  # nobody reached half the group: plan from whatever got a like
    if not liked:
        raise NothingToPlan("Nobody liked any of the places yet, so there is nothing to schedule.")

    llm = llm or llm_module.make_llm_client()
    dates, known = trip_dates(context), {s["id"] for s in sources}
    eligible = liked + maybe  # only places somebody liked can be scheduled
    attempts, feedback = [], ""
    for _ in range(config.MAX_REVIEW_ATTEMPTS + 1):
        try:
            raw = scheduler_agent(llm, model, context, liked, maybe, sources, feedback)
            schedule = normalize_schedule(raw, dates, eligible, known)
            review = quality_check_agent(llm, model, context, schedule, eligible, sources)
        except Exception as exc:  # noqa: BLE001
            if attempts:
                break  # a failed re-plan keeps the first draft
            if isinstance(exc, AgentError):
                raise
            raise _wrap(exc) from exc
        attempts.append((schedule, review))
        if review["approved"]:
            break
        feedback = feedback_text(review)

    schedule, review = min(reversed(attempts), key=lambda pair: _errors(pair[1]))
    review["attempts"] = len(attempts)
    plan = to_app_plan(schedule, prepare_places(cards), sources, review, context["destination"])
    return {"plan": plan}
