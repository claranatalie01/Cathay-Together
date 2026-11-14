"""Agent 3: Scheduler. Asks the model for a day-by-day plan as JSON built from the liked cards."""
import json
from datetime import date

from . import config
from .checks import day_window, flight_limits
from .llm import ask_json
from .schedule import clock

SYSTEM = (
    "You are the Scheduler agent for Cathay Together, a group travel planning app by Cathay Pacific. "
    "Build an optimal day-by-day itinerary. Ensure all activities are within the group's budget, "
    "pace, and time constraints. Return only valid JSON, without commentary.\n" + config.EVIDENCE_RULES
)

SCHEDULE_FIELDS = (
    "id",
    "name",
    "category",
    "location",
    "estimated_cost_jpy",
    "estimated_duration_min",
    "best_time_of_day",
    "opening_hours",
    "closed_days",
    "like_count",
    "pass_count",
    "total_members",
    "source_ids",
)


def trip_dates(context: dict) -> list[str]:
    start = date.fromisoformat(context["dates"]["start"])
    end = date.fromisoformat(context["dates"]["end"])
    return [date.fromordinal(n).isoformat() for n in range(start.toordinal(), end.toordinal() + 1)]


def split_cards(cards: list[dict]) -> tuple[list[dict], list[dict]]:
    """Rank by expressed preferences. A missing vote does not count as a Pass."""
    liked, maybe = [], []
    for card in cards:
        if card["like_count"] < 1:
            continue
        (liked if card["like_count"] >= card["pass_count"] else maybe).append(card)
    liked.sort(key=lambda c: (c["like_count"] / (c["like_count"] + c["pass_count"]), c["like_count"]), reverse=True)
    return liked, maybe


def _compact(card: dict) -> dict:
    return {key: card[key] for key in SCHEDULE_FIELDS if key in card}


def _flight_text(context: dict) -> str:
    lines = [
        f"  {f['member']}: {f.get('origin') or '?'} → {f.get('destination') or '?'} "
        f"arrives {f.get('arrival_time') or '?'} on {f.get('arrival_date') or '?'}, "
        f"departs {f.get('departure_time') or '?'} on {f.get('departure_date') or '?'}"
        for f in context.get("flights", [])
    ]
    return "\n".join(lines) if lines else "  No flight details provided."


def scheduler_agent(
    llm,
    model: str,
    context: dict,
    liked: list[dict],
    maybe: list[dict],
    sources: list[dict],
    transfers: dict,
    feedback: str = "",
    neutral: list[dict] | None = None,
) -> dict:
    dates = trip_dates(context)
    arrival, departure = flight_limits(context.get("flights", []))
    windows = []
    for index, day in enumerate(dates):
        start, end = day_window(day, arrival, departure)
        if end <= start:
            window = "no shared time, return an empty stops array"
        else:
            full = 0 < index < len(dates) - 1 and (start, end) == (config.DAY_START, config.DAY_END)
            window = f"{clock(start)}–{clock(end)} ({'lunch and dinner required' if full else 'meals optional'})"
        windows.append(f"  - {day} ({date.fromisoformat(day).strftime('%A')}): {window}")
    date_lines = "\n".join(windows)
    budget = context.get("budget_per_person", config.DEFAULT_BUDGET_PER_PERSON)
    pace = context.get("pace", "moderate")
    max_activities = config.PACE_LIMIT.get(pace, 3)
    evidence = [
        {"id": s["id"], "title": s["title"], "url": s["url"], "excerpt": s["excerpt"][:1200]} for s in sources
    ]
    feedback_block = (
        f"\nPREVIOUS DRAFT FEEDBACK:\n{feedback}\n"
        "Build a simpler draft. Keep at least one liked activity if it fits, and leave out "
        "optional stops that would make the schedule fail a rule.\n" if feedback else ""
    )
    neutral_block = (
        "Nobody liked an activity. You may schedule these neutral suggestions where they fit. "
        "Use meals and free time if the list is empty.\n"
        + json.dumps([_compact(card) for card in neutral], ensure_ascii=False)
        if neutral is not None else ""
    )
    return ask_json(
        llm,
        model,
        SYSTEM,
        f"""
DESTINATION: {context['destination']}
GROUP SIZE: {context['group_size']}
BUDGET: ¥{budget}/person for activities + meals
PACE: {pace}

TRIP DAYS AND SHARED WINDOWS (local times with the flight buffers already applied):
{date_lines}

FLIGHT DETAILS:
{_flight_text(context)}

LIKED ACTIVITIES (include these, ordered by group consensus; leave one out only if it cannot fit a shared window, its opening hours, a closed day or the pace limit):
{json.dumps([_compact(c) for c in liked], ensure_ascii=False)}

MAYBE ACTIVITIES (only if time permits):
{json.dumps([_compact(c) for c in maybe], ensure_ascii=False)}

{neutral_block}

MINIMUM TRANSFER MINUTES BETWEEN ACTIVITY IDS (matrix is symmetric):
{json.dumps(transfers["between"], separators=(",", ":"))}
Use {transfers["fallbackMinutes"]} minutes when a pair is absent, until a district is known. Give each generic meal one specific nearby district in its area field.

RETRIEVED EVIDENCE (for opening hours and details):
{json.dumps(evidence, ensure_ascii=False)}
Use supplied card hours and costs as estimates when a previously started trip has no web sources.
{feedback_block}
RULES:
1. Return exactly the listed dates in order. Every stop, including meals and free time, must start and finish inside that day's shared window.
2. A day with no shared time has no stops. Keep the first activity nearby and easy.
3. At most {max_activities} activities per day (type "activity"). Meals and free time do not count.
4. Every full day has a lunch (12:00-13:30) and a dinner (18:30-20:00) as type "meal". A full day is a middle day without flight buffers cutting into it. Breakfast is optional and is skipped on the arrival day.
5. Respect opening_hours, closed_days and best_time_of_day. Never schedule a closed day.
6. Group geographically close activities on the same day.
7. Leave at least the required transfer time between each day's physical stops. Free time does
   not change the last place. If a free block intervenes, leave the transfer gap after that block.
8. Include one "free" slot of 60-120 minutes per full day.
9. Activities with more votes get priority. Use each card at most once, and only card ids listed above.
10. Keep the running cost per person under ¥{budget}.
11. A liked card whose category is "food" belongs in a lunch or dinner slot: schedule it as {{"type": "meal", "meal": "lunch", "card_id": "an id from the lists above", "start": "12:30"}} instead of an unnamed meal. Never write a liked restaurant into a generic meal's text and leave its card out.
    Other meals: name a specific place only if the evidence supports it, otherwise describe the meal type and area and say "Not verified". Never invent prices or hours.
12. Keep every stop within 08:00–21:30 local time.

Return ONLY valid JSON in this exact format:
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "title": "Short theme, under 40 characters",
      "stops": [
        {{"type": "activity", "card_id": "an id from the lists above", "start": "10:00", "minutes": 90, "note": "why it fits here"}},
        {{"type": "meal", "meal": "lunch", "start": "12:30", "name": "Place or meal type", "area": "District", "estimated_cost_jpy": 1500, "note": "Not verified", "source_ids": ["S2"]}},
        {{"type": "free", "start": "15:30", "minutes": 90, "note": "Flexible time"}}
      ]
    }}
  ]
}}
""",
        temperature=0.4,
        max_tokens=config.PLANNER_MAX_TOKENS,
    )
