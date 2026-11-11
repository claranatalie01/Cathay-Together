"""Photo selection: a web photo is used only when it names the place, and each photo is used once."""
from server.itinerary.explorer import SourceBook
from server.itinerary.explorer import SourceBook
from server.itinerary.photos import attach_photos, best_photo, clean_images, find_place_images, matches_place
from server.itinerary.places import enrich_cards, images_for


def test_name_must_appear_in_description_or_title():
    assert matches_place("Senso-ji Temple Visit", "A photo of Sensō-ji's pagoda")
    assert matches_place("Tsukiji Sushi Class", "", "Tsukiji fish market guide")  # 1 of 2 distinctive words
    assert not matches_place("Senso-ji Temple Visit", "A blue sky over Osaka castle")


def test_generic_words_alone_never_match():
    assert not matches_place("Tokyo Food Tour", "Best food in Tokyo")
    assert not matches_place("Night Market Walk", "a night market")


def test_category_word_does_not_identify_a_restaurant():
    # A different shop's ramen bowl must not be accepted for "Ramen at Jikasei Mensho".
    assert not matches_place("Ramen at Jikasei Mensho", "A bowl of tantanmen ramen with chili oil")
    assert matches_place("Ramen at Jikasei Mensho", "Jikasei Mensho ramen bowl")


def test_clean_images_keeps_https_and_drops_social_and_bad_urls():
    raw = [
        "https://img.example.com/a.jpg",
        {"url": "https://img.example.com/b.jpg", "title": "Guide", "description": "Senso-ji gate"},
        "http://insecure.example.com/c.jpg",
        {"url": "https://lookaside.fbsbx.com/x.jpg"},
        {"url": "javascript:alert(1)"},
        42,
    ]
    images = clean_images(raw, "https://page.example/p", "Page")
    assert [i["url"] for i in images] == ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"]
    assert images[1]["description"] == "Senso-ji gate" and images[1]["page_title"] == "Guide"
    assert images[0]["page_title"] == "Page"


def test_source_book_collects_images_from_results():
    book = SourceBook()
    book.add([{"url": "https://guide.example/s", "title": "Senso-ji guide", "content": "text",
               "images": [{"url": "https://img.example/s.jpg", "description": "Senso-ji pagoda"}]}])
    assert book.images[0]["page_url"] == "https://guide.example/s"


def test_best_photo_picks_matching_candidate_and_ignores_others():
    card = {"name": "Senso-ji Temple"}
    candidates = [
        {"url": "https://x.example/1.jpg", "description": "Osaka castle", "page_title": "Osaka"},
        {"url": "https://x.example/2.jpg", "description": "Senso-ji pagoda", "page_title": "Guide"},
    ]
    assert best_photo(card, candidates)["url"] == "https://x.example/2.jpg"


def test_page_title_alone_is_never_evidence():
    # Live failures: a site banner on a page called "Tokyo Ramen Festa", a Kannon painting on a Senso-ji page.
    card = {"name": "Tokyo Ramen Festa"}
    assert best_photo(card, [{"url": "https://x.example/og.jpg", "description": "", "page_title": "Tokyo Ramen Festa 2026"}]) is None
    assert best_photo({"name": "Senso-ji"}, [{"url": "https://x.example/k.jpg", "description": "", "page_title": "Senso-ji - Wikipedia"}]) is None


def test_thumbnails_and_site_chrome_are_dropped():
    raw = [
        "https://tblg.k-img.com/restaurant/images/Rvw/138624/150x150_square_138624902.jpg",
        "https://upload.example/thumb/120px-Kannon.JPG",
        "https://menumiru.com/og-image.jpg",
        "https://cdn.example/photos/big-1280x853.jpg",
        "https://cdn.example/photos/logo.png",
    ]
    urls = [i["url"] for i in clean_images(raw, "https://p.example", "P")]
    assert urls == ["https://cdn.example/photos/big-1280x853.jpg"]


def test_description_overrules_matching_page_title():
    card = {"name": "Yanesen Food Tour"}
    wrong = {"url": "https://x.example/shrine.jpg", "description": "A red shrine gate with ginkgo trees",
             "page_title": "Food and History in Yanesen"}
    right = {"url": "https://x.example/food.jpg", "description": "A Yanesen food stall at dusk", "page_title": "Yanesen"}
    assert best_photo(card, [wrong]) is None
    assert best_photo(card, [wrong, right])["url"] == "https://x.example/food.jpg"


def test_targeted_candidates_win_and_each_photo_is_used_once():
    cards = [{"id": "card_1", "name": "Senso-ji"}, {"id": "card_2", "name": "Senso-ji Night"}, {"id": "card_3", "name": "Meiji Shrine"}]
    per_card = {"card_1": [{"url": "https://x.example/s.jpg", "description": "Senso-ji", "page_url": "p", "page_title": "p"}]}
    shared = [{"url": "https://x.example/s.jpg", "description": "Senso-ji", "page_url": "q", "page_title": "q"}]
    attach_photos(cards, per_card, shared)
    assert cards[0]["web_photo"]["verified"] is True and cards[0]["web_photo"]["page_url"] == "p"
    assert cards[1]["web_photo"] is None  # its only match was already used
    assert cards[2]["web_photo"] is None


class TargetedSearch:
    def __init__(self):
        self.queries = []

    def search(self, query, **kwargs):
        self.queries.append((query, kwargs))
        if "Uoriki" in query:
            return {"results": [{"url": "https://guide.example/u", "title": "Uoriki guide", "images": [
                {"url": "https://img.example/u.jpg", "title": "Uoriki guide", "description": "Uoriki sushi counter"}]}]}
        raise RuntimeError("network down")


def test_find_place_images_uses_advanced_depth_and_survives_errors():
    cards = [{"id": "card_1", "name": "Uoriki Sushi"}, {"id": "card_2", "name": "Other"}]
    search = TargetedSearch()
    per_card = find_place_images(search, cards, "Tokyo, Japan")
    assert per_card["card_1"][0]["url"] == "https://img.example/u.jpg" and per_card["card_2"] == []
    assert all(kwargs["search_depth"] == "advanced" and kwargs["include_images"] for _, kwargs in search.queries)
    assert {q for q, _ in search.queries} == {"Uoriki Sushi Tokyo, Japan", "Other Tokyo, Japan"}


def test_find_place_images_without_client_is_empty():
    assert find_place_images(None, [{"id": "card_1", "name": "A"}], "Tokyo") == {}


def test_enrich_uses_web_photo_or_local_fallback():
    verified = {"name": "A", "category": "food", "web_photo": {"url": "https://x.example/a.jpg", "page_title": "Guide", "verified": True}}
    plain = {"name": "B", "category": "food", "web_photo": None}
    enrich_cards([verified, plain])
    assert verified["photo"] == verified["thumb"] == "https://x.example/a.jpg"
    assert verified["photo_source"] == "Guide"
    assert plain["photo"] == images_for("food")[0] and plain["photo_source"] is None
