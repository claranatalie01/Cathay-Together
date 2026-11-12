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
    errors = [issue["message"] for issue in deterministic_checks(schedule, cards, {}) if issue["severity"] == "error"]
    assert errors == ["A to B needs 30 minutes of travel, but only 20 are available."]
    stops[2]["start"] += 10
    assert all(issue["severity"] != "error" for issue in deterministic_checks(schedule, cards, {}))


def test_geocoding_matches_documented_venue_and_rejects_a_distant_place(monkeypatch):
    def entity(name, lat, lon):
        return {
            "labels": {"en": {"value": name}},
            "claims": {"P625": [{"rank": "normal", "mainsnak": {"datavalue": {"value": {
                "latitude": lat, "longitude": lon, "globe": "http://www.wikidata.org/entity/Q2",
            }}}}]},
        }

    def lookup(client, url, **params):
        if params["action"] == "query":
            return {"query": {"pages": [{"title": "Central Station", "pageprops": {"wikibase_item": "Q1"}}]}}
        if params["action"] == "wbsearchentities":
            if params["search"] == "Sensoji Temple":
                return {"search": [{"id": "Q2", "label": "Sensō-ji Temple", "match": {"text": "Sensoji Temple"}}]}
            return {"search": []}
        return {"entities": {"Q1": entity("Central Station", 51.5, 0), "Q2": entity("Sensō-ji Temple", 35.71, 139.79)}}

    monkeypatch.setattr(geocoding, "_get_json", lookup)
    cards = [
        {"name": "Temple visit", "venue_name": "Sensoji Temple"},
        {"name": "Central Station"},
        {"name": "Unmatched cafe"},
    ]
    geocoding.enrich_coordinates(cards, "Tokyo, Japan")
    assert cards[0]["coordinates"] == {"lat": 35.71, "lon": 139.79}
    assert cards[0]["coordinateSource"] == "https://www.wikidata.org/wiki/Q2"
    assert cards[1]["coordinates"] is None and cards[2]["coordinates"] is None
