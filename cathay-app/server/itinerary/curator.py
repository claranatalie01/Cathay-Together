"""Agent 2: Curator. Turns web evidence into swipe cards the group votes on."""
import json
import uuid

from . import config
from .llm import AgentError, ask_json
from .photos import attach_photos, find_place_images
from .places import enrich_cards

CATEGORY_LABELS = {
    "food": "Food",
    "culture": "Culture",
    "nature": "Nature",
    "shopping": "Shopping",
    "nightlife": "Nightlife",
    "adventure": "Adventure",
    "relaxation": "Relax",
}
TIME_LABELS = {"morning": "Morning", "afternoon": "Afternoon", "evening": "Evening", "any": "Any time"}

SYSTEM = (
    "You are the Curator agent for Cathay Together, a group travel planning app by Cathay Pacific. "
    "Your job is to extract specific activities from web search results and create swipe cards. "
    "Return only valid JSON, without commentary.\n" + config.EVIDENCE_RULES
)


def clean_text(value, limit: int) -> str:
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return " ".join(str(value).split())[:limit]
    return ""


def clean_int(value, default: int, low: int, high: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError, OverflowError):
        return default
    return max(low, min(high, number))


def cost_label(cost: int) -> str:
    return "Free" if cost <= 0 else f"¥{cost:,}"


def duration_label(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} min"
    hours = round(minutes / 30) / 2
    return f"{hours:g} {'hr' if hours == 1 else 'hrs'}"


def normalize_cards(raw_cards, known_source_ids: set[str]) -> list[dict]:
    """Keep only well-formed cards that cite real sources. Never trust the model's IDs or numbers."""
    cards: list[dict] = []
    seen: set[str] = set()
    for raw in raw_cards if isinstance(raw_cards, list) else []:
        if not isinstance(raw, dict):
            continue
        name = clean_text(raw.get("name"), 80)
        cited = raw.get("source_ids")
        source_ids = [s for s in cited if isinstance(s, str) and s in known_source_ids] if isinstance(cited, list) else []
        if not name or not source_ids or name.casefold() in seen:
            continue  # no evidence, no card
        seen.add(name.casefold())

        category = clean_text(raw.get("category"), 20).lower()
        if category not in config.CATEGORIES:
            category = "culture"
        best_time = clean_text(raw.get("best_time_of_day"), 12).lower()
        if best_time not in config.TIMES_OF_DAY:
            best_time = "any"
        closed = raw.get("closed_days")
        tags = raw.get("tags")
        cards.append(
            {
                "id": f"card_{uuid.uuid4().hex[:8]}",
                "name": name,
                "category": category,
                "headline": clean_text(raw.get("headline"), 60),
                "description": clean_text(raw.get("description"), 300),
                "estimated_cost_jpy": clean_int(raw.get("estimated_cost_jpy"), 0, 0, 100000),
                "estimated_duration_min": clean_int(raw.get("estimated_duration_min"), 90, 15, 480),
                "location": clean_text(raw.get("location"), 80) or "Not verified",
                "best_time_of_day": best_time,
                "opening_hours": clean_text(raw.get("opening_hours"), 60) or "Unknown",
                "closed_days": [clean_text(d, 12) for d in closed if isinstance(d, str)][:7] if isinstance(closed, list) else [],
                "is_outdoor": bool(raw.get("is_outdoor", False)),
                "group_friendly": bool(raw.get("group_friendly", True)),
                "tags": [clean_text(t, 24) for t in tags if isinstance(t, str)][:5] if isinstance(tags, list) else [],
                "source_ids": list(dict.fromkeys(source_ids)),
            }
        )
        if len(cards) >= config.MAX_CARDS:
            break
    return cards


def to_place(card: dict) -> dict:
    """Add the fields the app's swipe card shows. The raw card fields stay so planning can reuse them."""
    hours = card["opening_hours"]
    tip = [f"Hours: {hours}" if hours.lower() not in ("unknown", "not verified") else "Opening hours not verified"]
    if card["closed_days"]:
        tip.append("Closed " + ", ".join(card["closed_days"]))
    if card.get("google_rating"):
        tip.append(f"Google rating {card['google_rating']}")
    tip.append("Sources " + ", ".join(card["source_ids"]))
    label = CATEGORY_LABELS[card["category"]]
    cost = card["estimated_cost_jpy"]
    return {
        **card,
        "category_key": card["category"],
        "category": label,
        "area": card["location"],
        "description": card["description"] or card["headline"],
        "budget": cost_label(cost),
        "savedNote": f"{cost_label(cost)} est." if cost else "Free",
        "duration": duration_label(card["estimated_duration_min"]),
        "bestTime": TIME_LABELS[card["best_time_of_day"]],
        "tip": " · ".join(tip),
        "alt": f"{label} idea: {card['name']}",
    }


CARD_FORMAT = """{
  "swipe_cards": [
    {
      "name": "Activity Name",
      "category": "food|culture|nature|shopping|nightlife|adventure|relaxation",
      "headline": "Short punchy tagline (under 60 chars)",
      "description": "1-2 sentence description from the evidence",
      "estimated_cost_jpy": 2000,
      "estimated_duration_min": 90,
      "location": "Neighbourhood or district name",
      "best_time_of_day": "morning|afternoon|evening|any",
      "opening_hours": "09:00-17:00 or Unknown",
      "closed_days": ["Monday"],
      "is_outdoor": false,
      "group_friendly": true,
      "tags": ["sushi", "iconic"],
      "source_ids": ["S1", "S3"]
    }
  ]
}"""


def curator_agent(
    llm, model: str, context: dict, sources: list[dict], images: list[dict] | None = None, search_client=None
) -> list[dict]:
    """Return swipe cards (as UI places) built only from the retrieved sources and their photos."""
    dates = context["dates"]
    interests = ", ".join(context.get("interests") or []) or "general"
    evidence = [{k: s[k] for k in ("id", "title", "url", "excerpt")} for s in sources]
    result = ask_json(
        llm,
        model,
        SYSTEM,
        f"""
CONTEXT:
Destination: {context['destination']}
Travel dates: {dates['start']} to {dates['end']}
Group size: {context['group_size']}
Interests: {interests}
Budget: ¥{context.get('budget_per_person', config.DEFAULT_BUDGET_PER_PERSON)}/person for entire trip (activities + meals)
Budget level: {context.get('budget_level', 'moderate')}

WEB SEARCH EVIDENCE:
{json.dumps(evidence, ensure_ascii=False)}

TASK:
Extract {config.MIN_CARDS}-{config.MAX_CARDS} specific activities, restaurants, and attractions from the
evidence above. Create a balanced swipe deck for the group.

Return ONLY valid JSON in this exact format:
{CARD_FORMAT}

RULES:
- Only include activities with evidence from the search results
- Balance categories: at least 2 food, 2 culture, and spread across others
- Remove duplicates (same place, different names)
- Filter out anything likely closed during {dates['start']} to {dates['end']}
- Prioritise group-friendly activities for {context['group_size']} people
- Include a mix of free and paid options
- Include at least 3 food/restaurant options at different price points
- Set realistic estimated costs in JPY (or local currency); use 0 only for free places
- Use "Unknown" for opening hours that the evidence does not state
- Source IDs must reference the evidence provided
""",
        temperature=0.5,
    )
    raw_cards = result.get("swipe_cards") if isinstance(result, dict) else None
    cards = normalize_cards(raw_cards, {s["id"] for s in sources})
    if len(cards) < 3:
        raise AgentError("The curator could not find enough places in the search results. Try again.")
    own = find_place_images(search_client, cards, context["destination"])  # one targeted search per card
    cards = attach_photos(cards, own, images or [])  # only photos that name the place are used
    return [to_place(card) for card in enrich_cards(cards)]  # enrich_cards adds images and ratings
