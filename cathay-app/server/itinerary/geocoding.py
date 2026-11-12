"""Resolve named venues to latitude and longitude with Geoapify's forward geocoding API.

Needs GEOAPIFY_API_KEY in cathay-app/.env. Without it nothing is looked up, no card gets a point,
and the planner falls back to its flat 30 minute transfer estimate: the key being missing never
fails a deck.

A result is accepted only when all of these hold, so a wrong guess never becomes a travel time:
  - it lies within SEARCH_RADIUS_M of the destination's centre (checked here, not just requested);
  - its name shares the venue name's distinctive words (all of them for one or two words);
  - Geoapify's own confidence, when it gives one, is at least MIN_CONFIDENCE.
Otherwise the card keeps `coordinates = None`.

The key travels in the request's query string, so errors are logged by type only: a requests error
message can contain the full URL, key included.

Attribution: Geoapify's free plan asks for a "Powered by Geoapify" link, and the data is
OpenStreetMap's ("© OpenStreetMap contributors"). Both are shown on the itinerary screen when any
coordinate was used (see `usesGeoapify` in travel.py).
"""
import logging
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import requests

from . import config
from .travel import coordinate_pair, distance_km

log = logging.getLogger(__name__)
GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
GEOAPIFY_SOURCE = "https://www.geoapify.com/"  # stored as the card's coordinateSource
TOKYO_CENTER = (35.68, 139.77)  # (lat, lon)
SEARCH_RADIUS_M = 40_000
MIN_CONFIDENCE = 0.5
MAX_WORKERS = 4  # the free plan allows a handful of requests a second
REQUEST_TIMEOUT = 6
STOP_WORDS = {"the", "a", "an", "of", "and", "in", "at", "tokyo", "japan", "restaurant", "cafe", "shop", "store"}


def _fold(text: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", text or "").casefold() if not unicodedata.combining(ch))


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", _fold(text)) if len(w) >= 2 and w not in STOP_WORDS}


def names_match(venue: str, found: str) -> bool:
    """The returned name must share the venue's distinctive words.

    One or two words: all of them must match ("Tempura Kondo" must not match a soba and tempura shop).
    Three or more: at least half, so "Tsukiji Outer Market" still matches "Tsukiji Market".
    """
    wanted = _words(venue)
    if not wanted:
        return False
    needed = len(wanted) if len(wanted) <= 2 else -(-len(wanted) // 2)
    return len(wanted & _words(found)) >= needed


def _get_json(params: dict) -> dict:
    response = requests.get(GEOCODE_URL, params={**params, "format": "json"}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    body = response.json()
    return body if isinstance(body, dict) else {}


def _destination_center(destination: str, key: str) -> tuple[float, float] | None:
    """(lat, lon) of the destination city. Tokyo is known, so it costs no request."""
    city = destination.split(",")[0].strip()
    if not city:
        return None
    if city.casefold() == "tokyo":
        return TOKYO_CENTER
    results = _get_json({"text": destination, "type": "city", "limit": 1, "lang": "en", "apiKey": key}).get("results") or []
    pair = coordinate_pair({"lat": results[0].get("lat"), "lon": results[0].get("lon")}) if results else None
    return pair


def _lookup(venue: str, destination: str, center: tuple[float, float], key: str) -> dict | None:
    lat, lon = center
    results = _get_json({
        # The venue name alone: adding the city to the text makes Geoapify's confidence score collapse
        # even for an exact match. The circle filter below is what keeps results in the destination.
        "text": venue,
        "filter": f"circle:{lon},{lat},{SEARCH_RADIUS_M}",
        "bias": f"proximity:{lon},{lat}",
        "limit": 3,
        "lang": "en",
        "apiKey": key,
    }).get("results") or []
    for result in results:
        pair = coordinate_pair({"lat": result.get("lat"), "lon": result.get("lon")})
        if pair is None or distance_km(center, pair) * 1000 > SEARCH_RADIUS_M:
            continue
        found = result.get("name") or result.get("address_line1") or ""
        confidence = (result.get("rank") or {}).get("confidence")
        if isinstance(confidence, (int, float)) and confidence < MIN_CONFIDENCE:
            continue
        if names_match(venue, found):
            return {"lat": pair[0], "lon": pair[1]}
    return None


def _safe_lookup(venue: str, destination: str, center: tuple[float, float], key: str) -> dict | None:
    try:
        return _lookup(venue, destination, center, key)
    except (ValueError, requests.RequestException) as exc:
        log.info("Venue coordinate lookup failed: %s", type(exc).__name__)  # type only: the URL holds the key
        return None


def enrich_coordinates(cards: list[dict], destination: str) -> None:
    """Give each card without a point its coordinates, or None when no good match exists."""
    pending = [card for card in cards if "coordinates" not in card]
    key = config.env("GEOAPIFY_API_KEY")
    if not pending or not key:
        if pending:
            log.info("GEOAPIFY_API_KEY is not set: travel times use the 30 minute fallback.")
        return
    try:
        center = _destination_center(destination, key)
    except (ValueError, requests.RequestException) as exc:
        log.info("Destination lookup failed: %s", type(exc).__name__)
        return
    if center is None:
        return
    venues = {id(card): (card.get("venue_name") or card["name"]).strip() for card in pending}
    unique = list(dict.fromkeys(v for v in venues.values() if v and "|" not in v))
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, max(len(unique), 1))) as pool:
        points = dict(zip(unique, pool.map(lambda v: _safe_lookup(v, destination, center, key), unique)))
    for card in pending:
        point = points.get(venues[id(card)])
        card["coordinates"] = point
        if point:
            card["coordinateSource"] = GEOAPIFY_SOURCE
