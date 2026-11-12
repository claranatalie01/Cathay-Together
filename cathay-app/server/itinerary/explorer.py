"""Agent 1: Explorer. Searches the web (Tavily) for activities, restaurants and attractions."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from . import config
from .llm import AgentError, ask_json
from .photos import clean_images

SYSTEM = (
    "You are a travel research planning agent for Cathay Together, "
    "a group travel app by Cathay Pacific. "
    "Return only valid JSON, without commentary."
)


class SourceBook:
    """Collects de-duplicated search results with stable IDs (S1, S2, ...) and their candidate photos."""

    def __init__(self) -> None:
        self.sources: list[dict] = []
        self.images: list[dict] = []  # shared candidate photos, each with the page it came from
        self._urls: set[str] = set()
        self._image_urls: set[str] = set()

    def add_images(self, page_url: str, page_title: str, raw_images) -> None:
        for image in clean_images(raw_images, page_url, page_title):
            if image["url"] in self._image_urls:
                continue
            self._image_urls.add(image["url"])
            self.images.append(image)

    def add(self, results: list[dict]) -> tuple[int, int]:
        usable = new = 0
        for item in results:
            if len(self.sources) >= config.MAX_SOURCES:
                break
            url = (item.get("url") or "").strip()
            excerpt = item.get("content") or ""
            if not url or not excerpt:
                continue
            usable += 1
            if url in self._urls:
                continue
            self._urls.add(url)
            source_id = f"S{len(self.sources) + 1}"
            title = item.get("title") or url
            self.sources.append(
                {
                    "id": source_id,
                    "title": title,
                    "url": url,
                    "excerpt": excerpt[: config.MAX_SOURCE_CHARACTERS],
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            self.add_images(url, title, item.get("images"))
            new += 1
        return usable, new


def _search(search_client, query: str):
    try:
        return search_client.search(
            query=query,
            search_depth="basic",
            max_results=config.RESULTS_PER_SEARCH,
            include_answer=False,
            include_raw_content=False,
            include_images=True,
            include_image_descriptions=True,
            timeout=12,
        ), None
    except Exception as exc:  # noqa: BLE001 - one failed search must not stop the others
        return None, exc


def _run_queries(search_client, queries: list[str], book: SourceBook, log: list[dict], retry: bool) -> None:
    """Search in parallel, then merge in query order so source IDs are deterministic."""
    if not queries:
        return
    with ThreadPoolExecutor(max_workers=min(4, len(queries))) as pool:
        outcomes = list(pool.map(lambda q: _search(search_client, q), queries))
    for query, (result, error) in zip(queries, outcomes):
        entry = {"query": query, "status": "started"}
        if retry:
            entry["retry"] = True
        if error is not None:
            entry.update({"status": "error", "error_type": type(error).__name__})
        else:
            usable, new = book.add((result or {}).get("results", []))
            entry.update({"status": "ok", "usable_results": usable, "new_sources": new})
        log.append(entry)


def plan_queries(llm, model: str, context: dict) -> list[str]:
    destination = context["destination"]
    dates = context["dates"]
    group_size = context["group_size"]
    interests = ", ".join(context.get("interests") or []) or "general sightseeing"

    plan = ask_json(
        llm,
        model,
        SYSTEM,
        f"""
Create targeted web search queries to find group travel activities.

Destination: {destination}
Travel dates: {dates['start']} to {dates['end']}
Group size: {group_size} people
Interests: {interests}
Budget level: {context.get('budget_level', 'moderate')}

Return exactly this JSON structure:
{{
  "search_queries": [
    "query 1",
    "query 2"
  ]
}}

Generate 5-7 queries that collectively cover:
1. Best restaurants and food experiences in {destination} (street food to mid-range)
2. Cultural attractions, temples, museums in {destination}
3. Group-friendly activities for {group_size} people in {destination}
4. {destination} hidden gems locals recommend
5. {destination} shopping districts and markets
6. Outdoor/nature activities near {destination}
7. Any specific interests: {interests}

Keep each query under 300 characters. Make them specific and searchable.
""",
        temperature=0.4,
    )
    raw = plan.get("search_queries", []) if isinstance(plan, dict) else []
    cleaned = [q.strip()[:300] for q in raw if isinstance(q, str) and q.strip()]
    return list(dict.fromkeys(cleaned))[: config.MAX_SEARCHES]


def explorer_agent(llm, search_client, model: str, context: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Return (sources, candidate_images, search_log). If the first round finds too little, search more broadly."""
    destination = context["destination"]
    book = SourceBook()
    log: list[dict] = []

    _run_queries(search_client, plan_queries(llm, model, context), book, log, retry=False)

    if len(book.sources) < config.MIN_SOURCES:
        broader = [
            f"top things to do in {destination}",
            f"best {destination} travel guide activities",
            f"{destination} must visit places food culture",
        ]
        _run_queries(search_client, broader, book, log, retry=True)

    if not book.sources:
        raise AgentError("Web research did not find usable results. Try again.")

    return book.sources, book.images, log
