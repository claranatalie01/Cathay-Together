"""Resolve named Tokyo venues to documented Wikidata coordinates."""
import logging
import re
import unicodedata

import requests

from .travel import coordinate_pair, distance_km

log = logging.getLogger(__name__)
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "CathayTogether/0.1 (https://github.com/claranatalie01/Cathay-Together)"
TOKYO_CENTER = (35.68, 139.77)
MAX_ALIAS_LOOKUPS = 4


def _name_key(name: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", name).casefold() if ch.isalnum())


def _get_json(client, url: str, **params) -> dict:
    response = client.get(url, params={"format": "json", **params}, timeout=5)
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise ValueError("Wikimedia returned an API error")
    return body


def _point(entity: dict) -> dict | None:
    claims = entity.get("claims", {}).get("P625", [])
    for rank in ("preferred", "normal"):
        for claim in claims:
            if claim.get("rank") != rank:
                continue
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value") or {}
            if value.get("globe", "").split("/")[-1] != "Q2":
                continue
            point = {"lat": value.get("latitude"), "lon": value.get("longitude")}
            pair = coordinate_pair(point)
            if pair is not None and distance_km(TOKYO_CENTER, pair) <= 100:
                return point
    return None


def _find_venues(names: list[str]) -> dict:
    with requests.Session() as client:
        client.headers["User-Agent"] = USER_AGENT
        pages = _get_json(
            client, WIKIPEDIA_API, action="query", titles="|".join(names), redirects=1,
            prop="pageprops", ppprop="wikibase_item|disambiguation", formatversion=2,
        ).get("query", {}).get("pages", [])
        titles_by_id = {}
        for page in pages:
            props = page.get("pageprops", {})
            item_id = props.get("wikibase_item", "")
            if re.fullmatch(r"Q\d+", item_id) and "disambiguation" not in props:
                titles_by_id[item_id] = page["title"]
        known_titles = {_name_key(title) for title in titles_by_id.values()}
        unresolved = [name for name in names if _name_key(name) not in known_titles]
        for name in unresolved[:MAX_ALIAS_LOOKUPS]:
            try:
                results = _get_json(client, WIKIDATA_API, action="wbsearchentities",
                                    search=name, language="en", limit=4).get("search", [])
            except (ValueError, requests.RequestException):
                break  # Keep the successful page lookups even if alias search is unavailable.
            for result in results:
                item_id = result.get("id", "")
                match = result.get("match", {}).get("text", "")
                if re.fullmatch(r"Q\d+", item_id) and _name_key(match) == _name_key(name):
                    titles_by_id.setdefault(item_id, result["label"])
        if not titles_by_id:
            return {}
        entities = _get_json(
            client, WIKIDATA_API, action="wbgetentities", ids="|".join(titles_by_id),
            props="claims|labels|aliases", languages="en",
        ).get("entities", {})

    by_name = {}
    for item_id, title in titles_by_id.items():
        entity = entities.get(item_id, {})
        point = _point(entity)
        if point is None:
            continue
        label = entity.get("labels", {}).get("en", {}).get("value", "")
        aliases = [alias["value"] for alias in entity.get("aliases", {}).get("en", [])]
        for key in {_name_key(name) for name in (title, label, *aliases) if name}:
            by_name.setdefault(key, []).append((item_id, point))
    return by_name


def enrich_coordinates(cards: list[dict], destination: str) -> None:
    """Store a point only when one nearby item matches the venue title or a documented alias."""
    pending = [card for card in cards if "coordinates" not in card]
    if not pending:
        return
    names = [card.get("venue_name", card["name"]) for card in pending]
    titles = list(dict.fromkeys(name for name in names if name and "|" not in name))
    matches = {}
    if titles and destination.split(",")[0].strip().casefold() == "tokyo":
        try:
            matches = _find_venues(titles)
        except (ValueError, requests.RequestException) as exc:
            log.info("Venue coordinate lookup unavailable: %s", type(exc).__name__)
            return
    for card, name in zip(pending, names):
        venues = matches.get(_name_key(name), [])
        card["coordinates"] = None
        if len(venues) == 1:
            item_id, card["coordinates"] = venues[0]
            card["coordinateSource"] = f"https://www.wikidata.org/wiki/{item_id}"
