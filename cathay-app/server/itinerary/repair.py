"""Code-side repair: a place at least half the group liked must not be dropped just because the model
wrote a generic lunch or dinner instead of using it.

Only the safest fix is made here: a liked food place takes over a generic lunch or dinner stop that
does not already name one of the group's places, when its opening hours and closed days allow it.
Anything else is left for the reviewer's warning. The model proposes; this only fills an obvious gap.
"""
from datetime import date

from .checks import opening_window
from .schedule import meal_from_card

REPLACEABLE = ("lunch", "dinner")


def _share(card: dict) -> float:
    return card.get("like_count", 0) / max(card.get("total_members", 1), 1)


def scheduled_ids(schedule: dict) -> set:
    return {s["card_id"] for day in schedule["days"] for s in day["stops"] if s.get("card_id")}


def adopt_liked_food(schedule: dict, cards: list[dict], known_sources: set) -> dict:
    """Return the schedule with majority-liked food places moved into generic meal slots where they fit."""
    taken = scheduled_ids(schedule)
    for card in sorted(cards, key=_share, reverse=True):
        liked, total = card.get("like_count", 0), card.get("total_members", 1)
        if card["id"] in taken or card.get("category") != "food" or liked < 1 or liked * 2 < total:
            continue
        window = opening_window(card.get("opening_hours", ""))
        placed = False
        for day in schedule["days"]:
            weekday = date.fromisoformat(day["date"]).strftime("%A").lower()[:3]
            if any(closed.lower()[:3] == weekday for closed in card.get("closed_days", [])):
                continue
            for index, stop in enumerate(day["stops"]):
                if stop["type"] != "meal" or stop.get("card_id") or stop["meal"] not in REPLACEABLE:
                    continue
                end = stop["start"] + stop["minutes"]
                if window and (stop["start"] < window[0] or end > window[1]):
                    continue
                day["stops"][index] = {
                    **meal_from_card(card, stop["meal"], stop["minutes"], f"Liked by {liked} of {total}.", known_sources),
                    "start": stop["start"],
                }
                taken.add(card["id"])
                placed = True
                break
            if placed:
                break
    return schedule
