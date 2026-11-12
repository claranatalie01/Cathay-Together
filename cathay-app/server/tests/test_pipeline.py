import pytest
from fastapi.testclient import TestClient

from server.app import app
from server.itinerary import pipeline
from server.itinerary.checks import deterministic_checks, opening_window
from server.itinerary.curator import normalize_cards
from server.itinerary.llm import AgentError, NothingToPlan, PlanConstraints, parse_json_response
from server.itinerary.schedule import normalize_schedule, sanitize_plan_cards

from .conftest import CONTEXT, DATES, REVIEW_OK, SOURCES, FakeLLM, FakeSearch, good_plan, raw_card, voted_cards


def test_parse_json_handles_fence_and_prose():
    assert parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_response('Here you go: {"a": 1} Enjoy') == {"a": 1}


def test_normalize_cards_drops_uncited_duplicates_and_bad_values():
    raw = [raw_card("Good"), raw_card("No evidence", source_ids=["S99"]), raw_card("good"), "junk",
           raw_card("Bad cat", category="spaceflight", estimated_cost_jpy="lots")]
    cards = normalize_cards(raw, {"S1"})
    assert [c["name"] for c in cards] == ["Good", "Bad cat"]
    assert cards[1]["category"] == "culture" and cards[1]["estimated_cost_jpy"] == 0
    assert cards[0]["id"].startswith("card_")


def test_discover_returns_places_with_sources():
    cards = [raw_card("Tsukiji"), raw_card("Senso-ji", category="culture"), raw_card("Gyoen", category="nature")]
    llm = FakeLLM([{"search_queries": ["a", "b"]}, {"swipe_cards": cards}])
    out = pipeline.run_discover(CONTEXT, "GPT-4o-Mini", llm=llm, search=FakeSearch())
    place = out["places"][0]
    assert len(out["places"]) == 3 and place["photo"].startswith("/assets/")
    assert place["budget"] == "¥2,000" and place["bestTime"] == "Morning"
    assert out["sources"][0]["id"] == "S1"


def test_discover_fails_clearly_without_evidence():
    class Empty:
        def search(self, **_):
            return {"results": []}

    with pytest.raises(AgentError):
        pipeline.run_discover(CONTEXT, "m", llm=FakeLLM([{"search_queries": ["a"]}]), search=Empty())


class SearchWithPhotos(FakeSearch):
    def search(self, query, **kwargs):
        if kwargs["search_depth"] == "advanced":
            return {"images": [{"url": "https://img.example/tsukiji.jpg", "description": "Tsukiji market stalls"}]}
        return super().search(query, **kwargs)


def test_discover_and_refresh_use_matched_web_photos():
    cards = [raw_card("Tsukiji"), raw_card("Senso-ji", category="culture"), raw_card("Gyoen", category="nature")]
    llm = FakeLLM([{"search_queries": ["a", "b", "c"]}, {"swipe_cards": cards}])
    search = SearchWithPhotos()
    places = pipeline.run_discover(CONTEXT, "m", llm=llm, search=search)["places"]
    assert places[0]["photo"] == places[0]["thumb"] == "https://img.example/tsukiji.jpg"
    assert places[0]["photoSource"] == "Tavily image search"
    assert places[1]["photo"].startswith("/assets/")
    saved = [{key: value for key, value in place.items() if key != "photoSourceUrl"} for place in places]
    saved[0]["photo"] = "/assets/ab624.png"
    refreshed = pipeline.refresh_place_photos(saved, "Tokyo", search)
    assert [p["id"] for p in refreshed] == [p["id"] for p in saved]
    assert refreshed[0]["description"] == saved[0]["description"]
    assert refreshed[0]["photo"] == places[0]["photo"]


def test_plan_builds_app_shape_and_ignores_unliked_cards():
    plan = good_plan()
    plan["days"][1]["stops"].append({"type": "activity", "card_id": "card_cccccccc", "start": "10:00", "minutes": 30})
    cards = voted_cards()
    cards[0].update(photo="https://img.example/tsukiji.jpg", thumb="https://img.example/tsukiji.jpg",
                    photoSource="Guide", photoSourceUrl="https://example.com/g")
    out = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([plan, REVIEW_OK]))["plan"]
    assert [d["date"] for d in out["days"]] == DATES
    assert "place-card_aaaaaaaa" in out["stops"] and "place-card_cccccccc" not in out["stops"]
    assert out["stops"]["place-card_aaaaaaaa"]["liked"] == 2
    assert out["stops"]["place-card_aaaaaaaa"]["photoSourceUrl"] == "https://example.com/g"
    assert out["stops"]["place-card_aaaaaaaa"]["thumb"] == "https://img.example/tsukiji.jpg"
    assert all(i in out["stops"] for d in out["days"] for i in d["stopIds"])


def test_plan_replans_once_when_rules_find_errors():
    bad = good_plan()
    bad["days"][1]["stops"][0]["start"] = "07:00"  # before opening: a rule error
    llm = FakeLLM([bad, good_plan(), REVIEW_OK])
    out = pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=llm)["plan"]
    assert out["review"]["approved"] is True and out["review"]["attempts"] == 2


def test_plan_retries_with_exact_windows_when_flights_erase_first_and_last_days():
    context = {**CONTEXT, "group_size": 3, "flights": [
        *CONTEXT["flights"],
        {"member": "B", "arrival_date": DATES[0], "arrival_time": "21:15",
         "departure_date": DATES[-1], "departure_time": "10:10"},
        {"member": "C", "arrival_date": DATES[0], "arrival_time": "14:30",
         "departure_date": DATES[-1], "departure_time": "17:45"},
    ]}
    fixed = good_plan()
    fixed["days"][0]["stops"] = []
    fixed["days"][2]["stops"] = []
    replies = iter([good_plan(), fixed, REVIEW_OK])

    class CheckWindows(FakeLLM):
        def create(self, messages, **kwargs):
            user_prompt = messages[-1]["content"]
            if "TRIP DAYS AND SHARED WINDOWS" in user_prompt:
                assert user_prompt.count("no shared time, return an empty stops array") == 2
                assert "08:00–21:30 (lunch and dinner required)" in user_prompt
            self.replies = [next(replies)]
            return super().create(messages=messages, **kwargs)

    plan = pipeline.run_plan(context, voted_cards(), SOURCES, "m", llm=CheckWindows([]))["plan"]
    assert plan["review"]["attempts"] == 2
    assert not plan["days"][0]["stopIds"] and not plan["days"][2]["stopIds"]
    assert plan["days"][1]["stopIds"]


def test_plan_reports_an_actual_rule_when_both_drafts_fail():
    bad = good_plan()
    bad["days"][1]["stops"][0]["start"] = "07:00"
    with pytest.raises(PlanConstraints, match="outside 08:00–21:30"):
        pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM([bad, bad]))


def test_plan_with_nothing_liked_is_rejected():
    cards = voted_cards()
    for c in cards:
        c["like_count"] = 0
    with pytest.raises(NothingToPlan):
        pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([]))


def test_rules_catch_closed_day_and_early_start():
    source = voted_cards()
    source[1]["closed_days"] = ["Sunday"]  # 2026-11-22 is a Sunday
    cards = sanitize_plan_cards(source)
    raw = good_plan()
    raw["days"][0]["stops"].insert(0, {"type": "activity", "card_id": "card_aaaaaaaa", "start": "10:00", "minutes": 60})
    raw["days"][1]["stops"][0] = {"type": "activity", "card_id": "card_bbbbbbbb", "start": "09:30", "minutes": 60}
    schedule = normalize_schedule(raw, DATES, cards, {"S1"})
    messages = " ".join(i["message"] for i in deterministic_checks(schedule, cards, CONTEXT))
    assert "closed on Sunday" in messages and "landed" in messages
    assert opening_window("09:00-17:00") == (540, 1020) and opening_window("Unknown") is None


def test_each_card_scheduled_once_and_bad_stops_dropped():
    cards = sanitize_plan_cards(voted_cards())
    raw = good_plan()
    raw["days"][2]["stops"] += [{"type": "activity", "card_id": "card_aaaaaaaa", "start": "10:00"}, {"type": "teleport"}, "junk"]
    schedule = normalize_schedule(raw, DATES, cards, {"S1"})
    assert sum(1 for d in schedule["days"] for s in d["stops"] if s.get("card_id") == "card_aaaaaaaa") == 1


def test_http_validation_and_authentication():
    client = TestClient(app, raise_server_exceptions=False)
    bad = client.post("/api/planner", json={"action": "discover", "groupId": "not-a-uuid"})
    assert bad.status_code == 422 and bad.json()["code"] == "validation_failed"
    res = client.post("/api/planner", json={"action": "discover", "groupId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"})
    assert res.status_code == 401 and res.json()["code"] == "unauthenticated"
