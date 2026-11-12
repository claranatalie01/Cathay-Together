"""Rule-based checks of a schedule. These never depend on the model, so a bad plan is always caught."""
import re
from datetime import datetime, timedelta

from . import config
from .schedule import clock, parse_clock, stop_cost, stop_name

HOURS_RE = re.compile(r"(\d{1,2}):(\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})")


def _issue(severity: str, day, message: str, fix: str) -> dict:
    return {"severity": severity, "day": day, "message": message, "suggested_fix": fix}


def opening_window(text: str) -> tuple[int, int] | None:
    """(open, close) in minutes from a string like '09:00-17:00'. Overnight or unknown hours give None."""
    match = HOURS_RE.search(text or "")
    if not match:
        return None
    opens = int(match.group(1)) * 60 + int(match.group(2))
    closes = int(match.group(3)) * 60 + int(match.group(4))
    return (opens, closes) if closes > opens else None


def flight_limits(flights: list[dict]) -> tuple[datetime | None, datetime | None]:
    """Latest arrival and earliest departure across the group, when the times are known."""
    arrivals, departures = [], []
    for flight in flights:
        for date_key, time_key, target in (
            ("arrival_date", "arrival_time", arrivals),
            ("departure_date", "departure_time", departures),
        ):
            minutes = parse_clock(flight.get(time_key))
            try:
                if flight.get(date_key) and minutes is not None:
                    target.append(datetime.fromisoformat(flight[date_key]) + timedelta(minutes=minutes))
            except ValueError:
                continue
    return (max(arrivals) if arrivals else None, min(departures) if departures else None)


def _stop_issues(stop, day, number, cards_by_id, weekday, arrival, departure, previous_end, previous_kind):
    issues = []
    name = stop_name(stop, cards_by_id)
    end = stop["start"] + stop["minutes"]
    midnight = datetime.fromisoformat(day["date"])
    if stop["start"] < config.DAY_START or end > config.DAY_END:
        issues.append(_issue("error", number, f"{name} falls outside 08:00–21:30.", "Move it inside the day's planning window."))
    if previous_end is not None:
        if stop["start"] < previous_end:
            issues.append(_issue("error", number, f"{name} overlaps the stop before it.", "Move it after the previous stop."))
        elif stop["start"] - previous_end < 15 and "free" not in (stop["type"], previous_kind):
            issues.append(_issue("warning", number, f"Less than 15 minutes of travel before {name}.", "Leave about 30 minutes."))
    if arrival and midnight + timedelta(minutes=stop["start"]) < arrival + timedelta(minutes=config.ARRIVAL_BUFFER_MIN):
        issues.append(_issue("error", number, f"{name} starts before everyone has landed and cleared the airport.", "Start at least 90 minutes after the last arrival."))
    if departure and midnight + timedelta(minutes=end) > departure - timedelta(minutes=config.DEPARTURE_BUFFER_MIN):
        issues.append(_issue("error", number, f"{name} ends less than 3 hours before the earliest departure.", "End at least 3 hours before departure."))
    if stop["type"] == "activity":
        card = cards_by_id[stop["card_id"]]
        if any(closed.lower()[:3] == weekday.lower()[:3] for closed in card["closed_days"]):
            issues.append(_issue("error", number, f"{name} is closed on {weekday}.", "Move it to another day."))
        window = opening_window(card["opening_hours"])
        if window and (stop["start"] < window[0] or end > window[1]):
            issues.append(
                _issue("error", number, f"{name} is scheduled {clock(stop['start'])}-{clock(end)} but open {clock(window[0])}-{clock(window[1])}.", "Schedule it inside opening hours.")
            )
    return issues


def _day_issues(day, number, last, cards_by_id, context, arrival, departure):
    stops, issues = day["stops"], []
    midnight = datetime.fromisoformat(day["date"])
    weekday = midnight.strftime("%A")
    full_day = (
        number not in (1, last)
        and (not arrival or midnight + timedelta(minutes=config.DAY_START) >= arrival + timedelta(minutes=config.ARRIVAL_BUFFER_MIN))
        and (not departure or midnight + timedelta(minutes=config.DAY_END) <= departure - timedelta(minutes=config.DEPARTURE_BUFFER_MIN))
    )
    limit = config.PACE_LIMIT.get(context.get("pace", "moderate"), 3)
    activities = [s for s in stops if s["type"] == "activity"]
    if len(activities) > limit:
        issues.append(_issue("error", number, f"{len(activities)} activities is too many for a {context.get('pace', 'moderate')} pace (max {limit}).", "Move one to another day."))
    meals = {s["meal"] for s in stops if s["type"] == "meal"}
    for meal in ("lunch", "dinner"):
        if meal not in meals:
            issues.append(_issue("error" if full_day else "warning", number, f"No {meal} planned.", f"Add a {meal} near the day's activities."))
    if full_day and not any(s["type"] == "free" for s in stops):
        issues.append(_issue("warning", number, "No free time planned.", "Add a 1-2 hour flexible slot."))
    previous_end = previous_kind = None
    for stop in stops:
        issues += _stop_issues(stop, day, number, cards_by_id, weekday, arrival, departure, previous_end, previous_kind)
        previous_end, previous_kind = stop["start"] + stop["minutes"], stop["type"]
    return issues


def deterministic_checks(schedule: dict, cards: list[dict], context: dict) -> list[dict]:
    cards_by_id = {c["id"]: c for c in cards}
    arrival, departure = flight_limits(context.get("flights", []))
    days, issues, total = schedule["days"], [], 0
    for number, day in enumerate(days, start=1):
        issues += _day_issues(day, number, len(days), cards_by_id, context, arrival, departure)
        total += sum(stop_cost(s, cards_by_id) for s in day["stops"])
    budget = context.get("budget_per_person", config.DEFAULT_BUDGET_PER_PERSON)
    if total > budget:
        issues.append(_issue("error", None, f"Estimated cost ¥{total:,} per person is over the ¥{budget:,} budget.", "Swap a paid stop for a free one."))
    return issues


def estimated_total(schedule: dict, cards: list[dict]) -> int:
    cards_by_id = {c["id"]: c for c in cards}
    return sum(stop_cost(s, cards_by_id) for day in schedule["days"] for s in day["stops"])
