"""Turns the Scheduler's raw JSON into a trusted schedule.

The model proposes; this module decides what is accepted. Card ids, source ids, times,
durations and costs are all validated here, so a bad model reply cannot reach the app.
"""
import re
from datetime import date

from . import config
from .curator import clean_int, clean_text
from .llm import AgentError
from .travel import coordinate_pair, transfer_minutes

TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
MEALS = ("breakfast", "lunch", "dinner")
MEAL_DEFAULT_START = {"breakfast": 8 * 60, "lunch": 12 * 60 + 30, "dinner": 19 * 60}


class InvalidDraft(AgentError):
    """A new model draft is needed before review."""


def parse_clock(value) -> int | None:
    match = TIME_RE.match(value.strip()) if isinstance(value, str) else None
    return int(match.group(1)) * 60 + int(match.group(2)) if match else None


def clock(minutes: int) -> str:
    minutes = max(0, min(minutes, 24 * 60 - 1))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def clean_url(value) -> str:
    """Only https URLs or the app's own /assets paths may be used as an image."""
    text = clean_text(value, 500)
    return text if text.startswith("https://") or text.startswith("/assets/") else ""


def sanitize_plan_cards(raw_cards) -> list[dict]:
    """Keep only the card fields planning needs, with safe types and ranges."""
    cards = []
    for raw in raw_cards if isinstance(raw_cards, list) else []:
        if not isinstance(raw, dict):
            continue
        card_id, name = clean_text(raw.get("id"), 40), clean_text(raw.get("name"), 80)
        if not card_id or not name:
            continue
        category = clean_text(raw.get("category_key") or raw.get("category"), 20).lower()
        closed, cited, tags = raw.get("closed_days"), raw.get("source_ids"), raw.get("tags")
        total = clean_int(raw.get("total_members"), 1, 1, 100000)
        coordinates = raw.get("coordinates")
        cards.append(
            {
                "id": card_id,
                "name": name,
                "category": category if category in config.CATEGORIES else "culture",
                "headline": clean_text(raw.get("headline"), 60),
                "description": clean_text(raw.get("description"), 300),
                "tags": [clean_text(t, 24) for t in tags if isinstance(t, str)][:5] if isinstance(tags, list) else [],
                "is_outdoor": bool(raw.get("is_outdoor", False)),
                "group_friendly": bool(raw.get("group_friendly", True)),
                "location": clean_text(raw.get("location"), 80) or "Not verified",
                "estimated_cost_jpy": clean_int(raw.get("estimated_cost_jpy"), 0, 0, 100000),
                "estimated_duration_min": clean_int(raw.get("estimated_duration_min"), 90, 15, 480),
                "best_time_of_day": clean_text(raw.get("best_time_of_day"), 12).lower() or "any",
                "opening_hours": clean_text(raw.get("opening_hours"), 60) or "Unknown",
                "closed_days": [clean_text(d, 12) for d in closed if isinstance(d, str)][:7] if isinstance(closed, list) else [],
                "source_ids": [clean_text(s, 8) for s in cited if isinstance(s, str)][:6] if isinstance(cited, list) else [],
                "photo": clean_url(raw.get("photo")),
                "thumb": clean_url(raw.get("thumb")),
                "photoSource": clean_text(raw.get("photoSource") or raw.get("photo_source"), 140) or None,
                "photoSourceUrl": clean_url(raw.get("photoSourceUrl")) or None,
                "coordinates": coordinates if coordinate_pair(coordinates) is not None else None,
                "coordinateSource": clean_url(raw.get("coordinateSource")) or None,
                "like_count": clean_int(raw.get("like_count"), 0, 0, total),
                "total_members": total,
            }
        )
    return cards

def _day_stops(raw_day, cards_by_id: dict, used: set, known_sources: set) -> list[dict]:
    stops, cursor = [], 9 * 60
    raw_stops = raw_day.get("stops") if isinstance(raw_day, dict) else None
    for raw in raw_stops if isinstance(raw_stops, list) else []:
        if not isinstance(raw, dict):
            continue
        kind, start = raw.get("type"), parse_clock(raw.get("start"))
        note = clean_text(raw.get("note"), 200)
        if kind == "activity":
            card = cards_by_id.get(raw.get("card_id"))
            if card is None or card["id"] in used:
                continue
            used.add(card["id"])
            minutes = clean_int(raw.get("minutes"), card["estimated_duration_min"], 15, 480)
            stop = {"type": "activity", "card_id": card["id"], "minutes": minutes, "note": note}
        elif kind == "meal":
            meal = clean_text(raw.get("meal"), 12).lower()
            meal = meal if meal in MEALS else "lunch"
            cited = raw.get("source_ids")
            stop = {
                "type": "meal",
                "meal": meal,
                "minutes": clean_int(raw.get("minutes"), 60, 20, 180),
                "name": clean_text(raw.get("name"), 80) or f"{meal.title()} nearby",
                "area": clean_text(raw.get("area"), 80) or "Not verified",
                "estimated_cost_jpy": clean_int(raw.get("estimated_cost_jpy"), 0, 0, 20000),
                "note": note,
                "source_ids": [s for s in cited if isinstance(s, str) and s in known_sources] if isinstance(cited, list) else [],
            }
            start = start if start is not None else MEAL_DEFAULT_START[meal]
        elif kind == "free":
            stop = {"type": "free", "minutes": clean_int(raw.get("minutes"), 90, 30, 240), "note": note or "Flexible time"}
        else:
            continue
        stop["start"] = start if start is not None else cursor
        cursor = stop["start"] + stop["minutes"] + 30
        stops.append(stop)
    return sorted(stops, key=lambda s: s["start"])


def normalize_schedule(raw, dates: list[str], cards: list[dict], known_sources: set) -> dict:
    raw_days = raw.get("days") if isinstance(raw, dict) else None
    if not isinstance(raw_days, list) or not raw_days:
        raise InvalidDraft("The draft was missing a readable days array.")
    by_date = {d.get("date"): d for d in raw_days if isinstance(d, dict)}
    cards_by_id = {c["id"]: c for c in cards}
    used: set = set()
    days = []
    for day_date in dates:
        raw_day = by_date.get(day_date)
        title = clean_text(raw_day.get("title"), 40) if isinstance(raw_day, dict) else ""
        days.append({"date": day_date, "title": title, "stops": _day_stops(raw_day, cards_by_id, used, known_sources)})
    if not any(stop["type"] == "activity" for day in days for stop in day["stops"]):
        raise InvalidDraft("The draft did not schedule any of the liked activities.")
    return {"days": days}


def stop_cost(stop: dict, cards_by_id: dict) -> int:
    if stop["type"] == "activity":
        return cards_by_id[stop["card_id"]]["estimated_cost_jpy"]
    return stop.get("estimated_cost_jpy", 0)


def stop_name(stop: dict, cards_by_id: dict) -> str:
    if stop["type"] == "activity":
        return cards_by_id[stop["card_id"]]["name"]
    return stop.get("name") or "Free time"


def render_schedule(schedule: dict, cards: list[dict], transfers: dict) -> str:
    """Plain-text view of the plan, for the reviewer and for feedback."""
    cards_by_id = {c["id"]: c for c in cards}
    lines = []
    for number, day in enumerate(schedule["days"], start=1):
        weekday = date.fromisoformat(day["date"]).strftime("%A")
        lines.append(f"Day {number} - {day['date']} ({weekday}) - {day['title'] or 'No theme'}")
        previous_place = None
        for stop in day["stops"]:
            end = stop["start"] + stop["minutes"]
            cited = ""
            if stop["type"] == "activity":
                cited = " " + " ".join(f"[{s}]" for s in cards_by_id[stop["card_id"]]["source_ids"])
            elif stop["type"] == "meal":
                cited = " " + " ".join(f"[{s}]" for s in stop["source_ids"])
            cost = stop_cost(stop, cards_by_id)
            cost_label = "cost unverified" if stop["type"] == "meal" and not cost else f"¥{cost:,}"
            transfer = ""
            if stop["type"] != "free":
                if previous_place is not None:
                    transfer = f" · {transfer_minutes(transfers, previous_place, stop)} min estimated transfer before this stop"
                previous_place = stop
            lines.append(
                f"  {clock(stop['start'])}-{clock(end)} {stop['type']}: {stop_name(stop, cards_by_id)}"
                f" ({cost_label}){cited}{transfer}"
            )
    return "\n".join(lines)
