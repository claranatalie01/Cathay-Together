"""Shared fixtures: a fake model and search client, so tests need no network and no keys."""
import json

CONTEXT = {
    "destination": "Tokyo, Japan",
    "dates": {"start": "2026-11-21", "end": "2026-11-23"},
    "group_size": 2,
    "interests": [],
    "budget_per_person": 15000,
    "budget_level": "moderate",
    "pace": "moderate",
    "flights": [
        {"member": "A", "origin": "HKG", "destination": "HND", "arrival_date": "2026-11-21", "arrival_time": "14:00",
         "departure_date": "2026-11-23", "departure_time": "18:00"},
    ],
}
DATES = ["2026-11-21", "2026-11-22", "2026-11-23"]
SOURCES = [{"id": "S1", "title": "Guide", "url": "https://example.com/g", "excerpt": "text"}]
REVIEW_OK = {"approved": True, "issues": [], "suggestions": [], "summary": "Looks fine."}


class FakeSearch:
    def search(self, query, **_):
        return {"results": [
            {"url": f"https://example.com/{query}/{i}", "title": f"T{i}", "content": f"Content {query} {i}"}
            for i in range(3)
        ]}


class FakeLLM:
    """Replays canned replies in order (dicts become JSON)."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.chat = self
        self.completions = self

    def create(self, model, messages, **_):
        reply = self.replies.pop(0)
        text = reply if isinstance(reply, str) else json.dumps(reply)
        message = type("M", (), {"content": text})
        return type("R", (), {"choices": [type("C", (), {"message": message})]})


def raw_card(name, **over):
    base = {"name": name, "category": "food", "headline": "Tasty", "description": "Good food.",
            "estimated_cost_jpy": 2000, "estimated_duration_min": 60, "location": "Tsukiji",
            "best_time_of_day": "morning", "opening_hours": "09:00-17:00", "closed_days": [], "source_ids": ["S1"]}
    return {**base, **over}


def voted_cards():
    return [
        {"id": "card_aaaaaaaa", "name": "Tsukiji", "category": "food", "estimated_cost_jpy": 2000,
         "estimated_duration_min": 60, "opening_hours": "09:00-17:00", "closed_days": [], "source_ids": ["S1"],
         "like_count": 2, "total_members": 2, "location": "Tsukiji"},
        {"id": "card_bbbbbbbb", "name": "Senso-ji", "category": "culture", "estimated_cost_jpy": 0,
         "estimated_duration_min": 90, "opening_hours": "Unknown", "closed_days": ["Monday"], "source_ids": ["S1"],
         "like_count": 1, "total_members": 2, "location": "Asakusa"},
        {"id": "card_cccccccc", "name": "Nobody", "category": "culture", "like_count": 0, "total_members": 2},
    ]


def good_plan():
    return {"days": [
        {"date": "2026-11-21", "title": "Arrive", "stops": [
            {"type": "meal", "meal": "dinner", "start": "19:00", "name": "Ramen", "area": "Shibuya",
             "estimated_cost_jpy": 1200, "source_ids": ["S1"]}]},
        {"date": "2026-11-22", "title": "Explore", "stops": [
            {"type": "activity", "card_id": "card_aaaaaaaa", "start": "09:30", "minutes": 60},
            {"type": "meal", "meal": "lunch", "start": "12:30", "name": "Soba", "area": "Asakusa", "estimated_cost_jpy": 1000},
            {"type": "activity", "card_id": "card_bbbbbbbb", "start": "14:00", "minutes": 90},
            {"type": "free", "start": "16:00", "minutes": 60},
            {"type": "meal", "meal": "dinner", "start": "19:00", "name": "Izakaya", "area": "Ueno", "estimated_cost_jpy": 2500}]},
        {"date": "2026-11-23", "title": "Goodbye", "stops": [
            {"type": "meal", "meal": "lunch", "start": "12:00", "name": "Lunch", "area": "Ginza", "estimated_cost_jpy": 1000}]},
    ]}
