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


def test_discover_returns_places_with_sources(monkeypatch):
    monkeypatch.setattr(pipeline, "enrich_coordinates", lambda places, destination: None)
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


def test_discover_and_refresh_use_matched_web_photos(monkeypatch):
    def add_coordinates(places, destination):
        assert destination == "Tokyo, Japan"
        places[0]["coordinates"] = {"lat": 35.66536, "lon": 139.77053}

    monkeypatch.setattr(pipeline, "enrich_coordinates", add_coordinates)
    cards = [raw_card("Tsukiji"), raw_card("Senso-ji", category="culture"), raw_card("Gyoen", category="nature")]
    llm = FakeLLM([{"search_queries": ["a", "b", "c"]}, {"swipe_cards": cards}])
    search = SearchWithPhotos()
    places = pipeline.run_discover(CONTEXT, "m", llm=llm, search=search)["places"]
    assert places[0]["photo"] == places[0]["thumb"] == "https://img.example/tsukiji.jpg"
    assert places[0]["photoSource"] == "Tavily image search"
    assert places[0]["coordinates"] == {"lat": 35.66536, "lon": 139.77053}
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


def test_plan_keeps_the_best_draft_when_both_drafts_break_a_rule():
    bad = good_plan()
    bad["days"][1]["stops"][0]["start"] = "07:00"  # before the 08:00 window: a rule error
    plan = pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM([bad, bad]))["plan"]
    assert plan["days"][1]["stopIds"], "the group still gets a plan"
    assert plan["review"]["approved"] is False and plan["review"]["attempts"] == 2
    assert any("outside 08:00–21:30" in i["message"] for i in plan["review"]["issues"])
    assert plan["review"]["summary"] == "" and plan["review"]["suggestions"] == []


def test_plan_prefers_the_draft_with_fewer_rule_errors():
    worse = good_plan()
    worse["days"][1]["stops"][0]["start"] = "07:00"
    worse["days"][1]["stops"][2]["start"] = "06:00"  # more rules broken
    better = good_plan()
    better["days"][1]["stops"][0]["start"] = "07:00"

    def error_count(*drafts):
        plan = pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM(list(drafts)))["plan"]
        return sum(1 for i in plan["review"]["issues"] if i["severity"] == "error")

    assert error_count(better, better) < error_count(worse, worse)
    assert error_count(worse, better) == error_count(better, better)  # the redraft is the better one: kept
    assert error_count(better, worse) == error_count(better, better)  # the first draft is the better one: kept


def test_plan_keeps_the_first_draft_when_the_redraft_fails():
    bad = good_plan()
    bad["days"][1]["stops"][0]["start"] = "07:00"
    plan = pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM([bad, "not json at all"]))["plan"]
    assert plan["days"][1]["stopIds"] and plan["review"]["attempts"] == 1


def test_plan_with_no_readable_draft_still_fails_clearly():
    with pytest.raises(PlanConstraints):
        pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM([{"days": []}, {"days": []}]))


def test_plan_accepts_a_short_transfer_with_a_warning_and_saves_the_estimate():
    cards = voted_cards()
    cards[0]["coordinates"] = {"lat": 0, "lon": 0}
    cards[1]["coordinates"] = {"lat": 0, "lon": 0.07}  # 35 minutes apart
    short = good_plan()
    short["days"][1]["stops"][2] = {"type": "activity", "card_id": "card_bbbbbbbb", "start": "10:50", "minutes": 60}
    short["days"][1]["stops"][1]["start"] = "12:45"  # only 20 minutes after the first activity ends
    plan = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([short, REVIEW_OK]))["plan"]
    assert plan["review"]["approved"] is True and plan["review"]["attempts"] == 1
    warnings = [i["message"] for i in plan["review"]["issues"] if i["severity"] == "warning"]
    assert any("needs 35 minutes of travel, but only 20 are available" in m for m in warnings)
    assert plan["transfers"]["between"]["card_aaaaaaaa"]["card_bbbbbbbb"] == 35


def test_a_majority_liked_place_left_out_is_flagged_but_does_not_block():
    cards = voted_cards()
    cards[0]["category"] = "culture"  # a food place would be moved into a meal slot instead (see below)
    plan_without = good_plan()
    plan_without["days"][1]["stops"] = [s for s in plan_without["days"][1]["stops"] if s.get("card_id") != "card_aaaaaaaa"]
    plan = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([plan_without, REVIEW_OK]))["plan"]
    notes = [i["message"] for i in plan["review"]["issues"]]
    assert "Tsukiji was liked by 2 of 2 but is not in the plan." in notes
    assert plan["review"]["approved"] is True


def test_scheduler_prompt_tells_the_model_to_include_liked_places_and_the_default_timeout_is_60():
    seen = []

    class Spy(FakeLLM):
        def create(self, messages, **kwargs):
            seen.append(messages[-1]["content"])
            return super().create(messages=messages, **kwargs)

    pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=Spy([good_plan(), REVIEW_OK]))
    assert "include these, ordered by group consensus" in seen[0]
    assert pipeline.config.llm_timeout() == 60.0


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


# ---- liked restaurants fill meal slots; saved plans are rebuilt when their inputs change -------------------

def test_a_liked_food_place_takes_over_a_generic_meal_slot():
    cards = voted_cards()  # Tsukiji (food, liked 2 of 2, open 09:00-17:00); the draft has a generic lunch at 12:30
    plan_without = good_plan()
    plan_without["days"][1]["stops"] = [s for s in plan_without["days"][1]["stops"] if s.get("card_id") != "card_aaaaaaaa"]
    out = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([plan_without, REVIEW_OK]))["plan"]
    stop = out["stops"]["place-card_aaaaaaaa"]
    assert stop["name"] == "Lunch: Tsukiji" and stop["source"] == "voted" and stop["placeId"] == "card_aaaaaaaa"
    assert stop["startTime"] == "12:30" and stop["liked"] == 2 and stop["total"] == 2
    assert "card_aaaaaaaa" not in out["maybe"]
    assert not any("is not in the plan" in i["message"] for i in out["review"]["issues"])


def test_the_model_may_schedule_a_liked_food_place_as_a_meal_itself():
    draft = good_plan()
    meals = [s for s in draft["days"][1]["stops"] if s["type"] == "meal"]
    draft["days"][1]["stops"] = [s for s in draft["days"][1]["stops"] if s.get("card_id") != "card_aaaaaaaa" and s is not meals[0]]
    draft["days"][1]["stops"].append({"type": "meal", "meal": "lunch", "card_id": "card_aaaaaaaa", "start": "12:30"})
    out = pipeline.run_plan(CONTEXT, voted_cards(), SOURCES, "m", llm=FakeLLM([draft, REVIEW_OK]))["plan"]
    assert out["stops"]["place-card_aaaaaaaa"]["name"] == "Lunch: Tsukiji"
    assert sum(1 for stop in out["stops"].values() if stop.get("placeId") == "card_aaaaaaaa") == 1


def test_a_liked_food_place_is_not_moved_into_a_meal_when_it_is_closed_then():
    cards = voted_cards()
    cards[0]["opening_hours"] = "17:00-21:00"  # closed at the 12:30 lunch; the 19:00 dinner would fit
    plan_without = good_plan()
    plan_without["days"][1]["stops"] = [s for s in plan_without["days"][1]["stops"] if s.get("card_id") != "card_aaaaaaaa"]
    out = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([plan_without, REVIEW_OK]))["plan"]
    assert out["stops"]["place-card_aaaaaaaa"]["startTime"] == "19:00"
    assert out["stops"]["place-card_aaaaaaaa"]["name"].startswith("Dinner")


def test_a_meal_that_is_a_place_uses_real_coordinates_for_its_transfers():
    cards = voted_cards()
    cards[0]["coordinates"] = {"lat": 0, "lon": 0}
    cards[1]["coordinates"] = {"lat": 0, "lon": 0.07}
    out = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([good_plan(), REVIEW_OK]))["plan"]
    assert out["transfers"]["between"]["card_aaaaaaaa"]["card_bbbbbbbb"] == 35
    meal_place = [s for s in out["stops"].values() if s.get("placeId") == "card_aaaaaaaa"]
    assert len(meal_place) == 1


def test_plan_fingerprint_changes_when_members_swipes_or_flights_change():
    from server.app import plan_fingerprint

    base = {"members": [{"user_id": "a"}, {"user_id": "b"}],
            "votes": [{"user_id": "a", "place_id": "p", "choice": "like"}],
            "flights": [{"user_id": "a", "direction": "outbound", "depart_at": "x", "arrive_at": "y"}]}
    same_but_reordered = {**base, "members": list(reversed(base["members"]))}
    assert plan_fingerprint(base) == plan_fingerprint(same_but_reordered)
    assert plan_fingerprint(base) != plan_fingerprint({**base, "members": base["members"] + [{"user_id": "c"}]})
    assert plan_fingerprint(base) != plan_fingerprint({**base, "votes": [{"user_id": "a", "place_id": "p", "choice": "pass"}]})
    assert plan_fingerprint(base) != plan_fingerprint({**base, "flights": []})


class FakeStore:
    def __init__(self, saved_fingerprint):
        self.saved, self.finished, self.viewer = saved_fingerprint, [], "a"
        self.inputs = {"destination": "Tokyo", "time_zone": "Asia/Tokyo", "start": "2026-11-21", "end": "2026-11-23",
                       "budget": 15000, "members": [{"user_id": "a", "preferences_saved_at": "t"}], "votes": [], "flights": []}

    def row(self, table, fields):
        if table == "itineraries":
            return {"fingerprint": self.saved} if self.saved else None
        return {"legacy": False, "places": [{"id": "p"}], "sources": []}

    def rpc(self, name, **args):
        if name == "trip_planner_inputs":
            return self.inputs
        if name == "finish_trip_planner_job":
            self.finished.append(args["result"])
        return True

    def release(self, token):
        pass


def test_a_saved_plan_is_reused_only_while_its_inputs_are_unchanged(monkeypatch):
    from server import app as app_module

    monkeypatch.setattr(app_module, "cards_for_plan", lambda deck, inputs: [])
    monkeypatch.setattr(app_module, "context_for", lambda inputs: {})
    monkeypatch.setattr(app_module.pipeline, "run_plan", lambda *a, **k: {"plan": {"days": []}})
    current = FakeStore(None)
    current.saved = app_module.plan_fingerprint(current.inputs)
    assert app_module.run_job(current, "plan") == {"ready": True} and current.finished == []  # nothing rebuilt

    stale = FakeStore("old-fingerprint")
    assert app_module.run_job(stale, "plan") == {"ready": True}
    assert len(stale.finished) == 1 and stale.finished[0]["fingerprint"] == app_module.plan_fingerprint(stale.inputs)

    first = FakeStore(None)  # no plan yet: built
    app_module.run_job(first, "plan")
    assert len(first.finished) == 1


def test_district_transfer_is_used_for_both_review_and_saved_plan(monkeypatch):
    cards = voted_cards()
    cards[0]["coordinates"] = {"lat": 0, "lon": 0}
    draft = good_plan()
    lunch = draft["days"][1]["stops"][1]
    lunch.update(area="Shinjuku", start="10:50")
    monkeypatch.setattr(pipeline, "locate_areas", lambda areas, destination: {
        "Shinjuku": {"lat": 0, "lon": 0.07},
    })
    result = pipeline.run_plan(CONTEXT, cards, SOURCES, "m", llm=FakeLLM([draft, REVIEW_OK]))["plan"]
    meal_id = f"meal-{DATES[1]}-lunch"
    assert result["transfers"]["between"]["card_aaaaaaaa"][meal_id] == 35
    assert any("needs 35 minutes of travel, but only 20 are available" in issue["message"]
               for issue in result["review"]["issues"])
