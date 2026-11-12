"""The shared planner's coordinate-based transfer estimates, in whole minutes."""
from math import asin, ceil, cos, radians, sin, sqrt

FALLBACK_MINUTES = 30


def coordinate_pair(value: object) -> tuple[float, float] | None:
    if not isinstance(value, dict):
        return None
    lat, lon = value.get("lat"), value.get("lon")
    if type(lat) in (int, float) and type(lon) in (int, float) and -90 <= lat <= 90 and -180 <= lon <= 180:
        return lat, lon
    return None


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(radians, a)
    lat2, lon2 = map(radians, b)
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(min(h, 1)))


def estimate_minutes(a: tuple[float, float], b: tuple[float, float]) -> int:
    street_km = distance_km(a, b) * 1.3
    minutes = street_km / 5 * 60 if street_km <= 1.2 else 10 + street_km / 25 * 60
    return max(5, ceil(minutes / 5) * 5)


def transfer_estimates(cards: list[dict]) -> dict:
    between = {}
    points = [(card["id"], coordinate_pair(card.get("coordinates"))) for card in cards]
    for index, (from_id, a) in enumerate(points):
        if a is None:
            continue
        for to_id, b in points[index + 1:]:
            if b is not None:
                minutes = estimate_minutes(a, b)
                between.setdefault(from_id, {})[to_id] = minutes
                between.setdefault(to_id, {})[from_id] = minutes
    uses_osm = any(
        card["id"] in between and (card.get("coordinateSource") or "").startswith("https://www.openstreetmap.org/")
        for card in cards
    )
    return {"fallbackMinutes": FALLBACK_MINUTES, "between": between, "usesOpenStreetMap": uses_osm}


def transfer_minutes(estimates: dict, previous_place: dict, stop: dict) -> int:
    return estimates["between"].get(previous_place.get("card_id"), {}).get(
        stop.get("card_id"), estimates["fallbackMinutes"]
    )
