"""Card images and optional Google Places ratings.

Images always come from the photo set that already ships with the app (public/assets),
so no remote image is ever hot-linked and no API key can leak into an image URL.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

import requests

from . import config

log = logging.getLogger(__name__)

# (cover, thumb) per category
LOCAL_IMAGES = {
    "food": ("/assets/ab624.png", "/assets/2c161.png"),
    "culture": ("/assets/culture-photo.jpg", "/assets/71254.png"),
    "nature": ("/assets/e1c39.png", "/assets/e1c39.png"),
    "shopping": ("/assets/shopping-photo.jpg", "/assets/shopping-photo.jpg"),
    "nightlife": ("/assets/photos/shinjuku-neon-night-cover.jpg", "/assets/photos/shinjuku-neon-night-thumb.jpg"),
    "adventure": ("/assets/photos/tokyo-skyline-night-cover.jpg", "/assets/photos/tokyo-skyline-night-thumb.jpg"),
    "relaxation": ("/assets/e1c39.png", "/assets/e1c39.png"),
}
FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"


def images_for(category: str) -> tuple[str, str]:
    return LOCAL_IMAGES.get(category, LOCAL_IMAGES["culture"])


def _lookup(card: dict, api_key: str) -> None:
    try:
        response = requests.get(
            FIND_PLACE_URL,
            params={
                "input": f"{card['name']} {card.get('location', '')}".strip(),
                "inputtype": "textquery",
                "fields": "name,rating",
                "key": api_key,
            },
            timeout=5,
        )
        found = response.json().get("candidates", [])
        if found and found[0].get("rating") is not None:
            card["google_rating"] = found[0]["rating"]
            card["google_enriched"] = True
    except Exception as exc:  # noqa: BLE001 - enrichment is optional
        log.info("Google Places lookup failed for %s: %s", card.get("name"), type(exc).__name__)


def enrich_cards(cards: list[dict]) -> list[dict]:
    """Attach images and, when GOOGLE_PLACES_API_KEY is set, a Google rating (the key never leaves the server).

    A verified web photo (card["web_photo"], set by photos.attach_photos) wins over the local category
    photo. The web photo's URL is https and is shown with its source page, so it can be checked.
    """
    for card in cards:
        web = card.get("web_photo")
        if web and web.get("verified"):
            card["photo"] = card["thumb"] = web["url"]
            card["photo_source"] = web["page_title"]
        else:
            card["photo"], card["thumb"] = images_for(card.get("category", "culture"))
            card["photo_source"] = None
        card["google_enriched"] = False
    api_key = config.env("GOOGLE_PLACES_API_KEY")
    if api_key and cards:
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda card: _lookup(card, api_key), cards))
    return cards
