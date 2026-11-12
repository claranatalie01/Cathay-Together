import requests

from server.itinerary import geocoding
from server.itinerary.checks import deterministic_checks
from server.itinerary.travel import coordinate_pair, estimate_minutes


def test_coordinate_formula_walks_transits_rounds_and_enforces_a_minimum():
    origin = (0, 0)
    assert estimate_minutes(origin, origin) == 5
    assert estimate_minutes(origin, (0, 0.008)) == 15
    assert estimate_minutes(origin, (0, 0.009)) == 15
    assert estimate_minutes(origin, (0, 0.07)) == 35
    assert estimate_minutes((0, 0.07), origin) == 35
    assert coordinate_pair({"lat": float("nan"), "lon": 0}) is None
    assert coordinate_pair({"lat": 0, "lon": 181}) is None


def test_free_time_keeps_previous_place_and_missing_coordinates_use_30_minutes():
    cards = [
        {"id": "a", "name": "A", "opening_hours": "Unknown", "closed_days": [], "estimated_cost_jpy": 0},
        {"id": "b", "name": "B", "opening_hours": "Unknown", "closed_days": [], "estimated_cost_jpy": 0},
    ]
    stops = [
        {"type": "activity", "card_id": "a", "start": 9 * 60, "minutes": 30},
        {"type": "free", "start": 10 * 60, "minutes": 60},
        {"type": "activity", "card_id": "b", "start": 11 * 60 + 20, "minutes": 30},
    ]
    schedule = {"days": [{"date": "2026-11-21", "stops": stops}]}
    # A short transfer is a warning, not a blocking error.
    issues = deterministic_checks(schedule, cards, {})
    short = [i for i in issues if "needs 30 minutes of travel" in i["message"]]
    assert [i["severity"] for i in short] == ["warning"]
    assert short[0]["message"] == "A to B needs 30 minutes of travel, but only 20 are available."
    stops[2]["start"] += 10
    assert not [i for i in deterministic_checks(schedule, cards, {}) if "needs 30 minutes" in i["message"]]


def _geo_result(name, lat, lon, confidence=0.9):
    return {"name": name, "lat": lat, "lon": lon, "rank": {"confidence": confidence}}


def test_geocoding_uses_geoapify_and_accepts_only_a_near_matching_result(monkeypatch):
    monkeypatch.setenv("GEOAPIFY_API_KEY", "test-key")
    calls = []

    def lookup(params):
        calls.append(params)
        venue = params["text"]
        if venue == "Sensoji Temple":
            return {"results": [_geo_result("Some Other Cafe", 35.7, 139.7), _geo_result("Sensoji Temple", 35.71, 139.79)]}
        if venue == "Central Station":
            return {"results": [_geo_result("Central Station", 51.5, 0.0)]}  # right name, wrong country
        if venue == "Weak Match":
            return {"results": [_geo_result("Weak Match", 35.7, 139.7, confidence=0.2)]}
        return {"results": []}

    monkeypatch.setattr(geocoding, "_get_json", lookup)
    cards = [
        {"name": "Temple visit", "venue_name": "Sensoji Temple"},
        {"name": "Central Station"},
        {"name": "Weak Match"},
        {"name": "Unmatched cafe"},
        {"name": "Sensoji again", "venue_name": "Sensoji Temple"},
    ]
    geocoding.enrich_coordinates(cards, "Tokyo, Japan")
    assert cards[0]["coordinates"] == {"lat": 35.71, "lon": 139.79}
    assert cards[0]["coordinateSource"] == "https://www.geoapify.com/"
    assert cards[4]["coordinates"] == cards[0]["coordinates"]
    assert all(cards[i]["coordinates"] is None for i in (1, 2, 3))
    assert "coordinateSource" not in cards[1]
    assert len(calls) == 4, "the same venue is looked up once"
    assert all(c["filter"].startswith("circle:139.77,35.68,") and c["bias"] == "proximity:139.77,35.68" for c in calls)
    assert all(c["apiKey"] == "test-key" for c in calls)


def test_geocoding_without_a_key_makes_no_request_and_leaves_cards_unchanged(monkeypatch):
    monkeypatch.delenv("GEOAPIFY_API_KEY", raising=False)
    monkeypatch.setattr(geocoding, "_get_json", lambda params: (_ for _ in ()).throw(AssertionError("no request expected")))
    cards = [{"name": "Tsukiji"}]
    geocoding.enrich_coordinates(cards, "Tokyo, Japan")
    assert "coordinates" not in cards[0]


def test_geocoding_survives_a_failed_request_and_never_logs_the_key(monkeypatch, caplog):
    monkeypatch.setenv("GEOAPIFY_API_KEY", "secret-test-key")

    def boom(params):
        raise requests.ConnectionError("https://api.geoapify.com/v1/geocode/search?apiKey=secret-test-key")

    monkeypatch.setattr(geocoding, "_get_json", boom)
    cards = [{"name": "Tsukiji"}]
    with caplog.at_level("INFO"):
        geocoding.enrich_coordinates(cards, "Tokyo, Japan")
    assert cards[0]["coordinates"] is None
    assert "secret-test-key" not in caplog.text and "ConnectionError" in caplog.text


def test_name_matching_ignores_accents_filler_words_and_order():
    assert geocoding.names_match("Sensō-ji Temple", "Senso-ji")
    assert geocoding.names_match("The Tsukiji Outer Market", "Tsukiji Market")
    assert not geocoding.names_match("Tsukiji Outer Market", "Shibuya Crossing")
    assert not geocoding.names_match("Tempura Kondo", "Ishiraku Otemachi – Soba & Tempura")  # two words: both needed
    assert not geocoding.names_match("", "Anything")


def test_transfer_estimates_flag_geoapify_credit_only_when_its_points_are_used():
    from server.itinerary.travel import transfer_estimates

    a = {"id": "a", "coordinates": {"lat": 0, "lon": 0}, "coordinateSource": "https://www.geoapify.com/"}
    b = {"id": "b", "coordinates": {"lat": 0, "lon": 0.07}, "coordinateSource": "https://www.geoapify.com/"}
    out = transfer_estimates([a, b])
    assert out["usesGeoapify"] and out["usesOpenStreetMap"] and out["between"]["a"]["b"] == 35
    none = transfer_estimates([{"id": "a"}, {"id": "b"}])
    assert not none["usesGeoapify"] and not none["usesOpenStreetMap"]
