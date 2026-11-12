"""Turns a checked schedule into the plan the app stores (shape documented in docs/api-contract.md)."""
from .curator import cost_label, duration_label, to_place
from .places import images_for
from .schedule import clock

MEAL_PHOTO = images_for("food")
FREE_PHOTO = ("/assets/photos/ueno-street-dusk-cover.jpg", "/assets/photos/ueno-street-dusk-thumb.jpg")


def prepare_places(cards: list[dict]) -> list[dict]:
    """Sanitised cards -> display places. Keeps the verified photo the card was given, else the local one."""
    for card in cards:
        if not card.get("photo"):
            card["photo"], card["thumb"] = images_for(card["category"])
    return [to_place(card) for card in cards]


def slot_label(start: int) -> str:
    return "Morning" if start < 12 * 60 else "Afternoon" if start < 17 * 60 else "Evening"


def _base(stop: dict) -> dict:
    return {"kind": "place", "slot": slot_label(stop["start"]), "startTime": clock(stop["start"]),
            "endTime": clock(stop["start"] + stop["minutes"]), "minutes": stop["minutes"]}


def _activity(stop: dict, place: dict) -> dict:
    return {
        **_base(stop),
        "id": f"place-{place['id']}",
        "source": "voted",
        "placeId": place["id"],
        "name": place["name"],
        "area": place["area"],
        "description": place["description"],
        "cost": place["estimated_cost_jpy"],
        "costLabel": place["budget"],
        "durationLabel": duration_label(stop["minutes"]),
        "photo": place["photo"],
        "thumb": place["thumb"],
        "alt": place["alt"],
        "photoSource": place.get("photo_source"),
        "category_key": place["category_key"],
        "liked": place["like_count"],
        "total": place["total_members"],
    }


def _meal(stop: dict, day: str, taken: set) -> dict:
    stop_id = f"meal-{day}-{stop['meal']}"
    while stop_id in taken:
        stop_id += "x"
    text = " · ".join(part for part in (stop["area"], stop["note"]) if part)
    if stop["source_ids"]:
        text += " " + " ".join(f"[{s}]" for s in stop["source_ids"])
    cost = stop["estimated_cost_jpy"]
    return {
        **_base(stop),
        "id": stop_id,
        "source": "suggested",
        "suggestedId": stop["meal"],
        "name": f"{stop['meal'].title()}: {stop['name']}",
        "area": stop["area"],
        "description": text,
        "cost": cost,
        "costLabel": cost_label(cost) if cost else "Cost not verified",
        "photo": MEAL_PHOTO[0],
        "thumb": MEAL_PHOTO[1],
        "alt": f"{stop['meal'].title()} suggestion",
    }


def _free(stop: dict, day: str) -> dict:
    return {
        **_base(stop),
        "id": f"free-{day}-{stop['start']}",
        "source": "suggested",
        "suggestedId": "free",
        "name": "Free time",
        "area": "Wherever you like",
        "description": stop["note"] or "Flexible time to rest, shop or explore.",
        "cost": 0,
        "costLabel": "Free",
        "photo": FREE_PHOTO[0],
        "thumb": FREE_PHOTO[1],
        "alt": "A quiet street at dusk",
    }


def to_app_plan(schedule: dict, places: list[dict], sources: list[dict], review: dict, destination: str) -> dict:
    by_id = {p["id"]: p for p in places}
    stops: dict[str, dict] = {}
    days, scheduled, cited = [], set(), []
    total_days = len(schedule["days"])
    city = destination.split(",")[0].strip() or "the city"
    for number, day in enumerate(schedule["days"], start=1):
        ids = []
        for stop in day["stops"]:
            if stop["type"] == "activity":
                place = by_id[stop["card_id"]]
                built = _activity(stop, place)
                scheduled.add(place["id"])
                cited += place["source_ids"]
            elif stop["type"] == "meal":
                built = _meal(stop, day["date"], set(stops))
                cited += stop["source_ids"]
            else:
                built = _free(stop, day["date"])
            built["start"] = (number - 1) * 1440 + stop["start"]
            built["end"] = built["start"] + built["minutes"]
            stops[built["id"]] = built
            ids.append(built["id"])
        fallback = "Arrive & settle in" if number == 1 else "A gentle goodbye" if number == total_days else f"Explore {city}"
        days.append({"date": day["date"], "title": day["title"] or fallback, "stopIds": ids})

    by_source = {s["id"]: s for s in sources}
    return {
        "days": days,
        "stops": stops,
        "maybe": [p["id"] for p in places if p["like_count"] >= 1 and p["id"] not in scheduled],
        "sources": [
            {"id": i, "title": by_source[i]["title"][:140], "url": by_source[i]["url"]}
            for i in dict.fromkeys(cited)
            if i in by_source
        ],
        "review": {k: review[k] for k in ("approved", "summary", "issues", "suggestions", "attempts")},
        "builtBy": "ai",
    }
