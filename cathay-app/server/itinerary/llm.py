"""LLM (Poe, OpenAI-compatible) and web search (Tavily) helpers."""
import json
import re
import time

from openai import OpenAI

from . import config


class AgentError(RuntimeError):
    """A failure whose message is safe to show to the user (it never contains keys or stack traces)."""

    status = 502
    code = "agent_failed"


class MissingConfig(AgentError):
    """A required key is missing from cathay-app/.env."""

    status = 503
    code = "not_configured"


class NothingToPlan(AgentError):
    """The group's votes leave nothing to schedule."""

    status = 422
    code = "nothing_to_plan"


class PlanConstraints(AgentError):
    """No draft passed the trip's validation checks."""

    status = 422
    code = "plan_constraints"


def make_llm_client() -> OpenAI:
    key = config.env("POE_API_KEY")
    if not key:
        raise MissingConfig("The language model is not configured. Try again once it is available.")
    return OpenAI(
        api_key=key,
        base_url=config.env("POE_BASE_URL", "https://api.poe.com/v1/"),
        timeout=25,
        max_retries=0,
    )


def make_search_client():
    key = config.env("TAVILY_API_KEY")
    if not key:
        raise MissingConfig("Web research is not configured. Try again once it is available.")
    from tavily import TavilyClient

    return TavilyClient(api_key=key)


def get_response_text(response) -> str:
    """Extract text from a chat completion."""
    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError):
        return ""
    if not isinstance(content, str):
        return ""
    return content.strip()


def ask_llm(
    client,
    model: str,
    system: str,
    user: str,
    max_retries: int = 1,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Make one LLM call, retrying on timeouts, rate limits and dropped connections."""
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            text = get_response_text(response)
            if not text:
                raise AgentError("The language model returned an empty response.")
            return text
        except Exception as exc:  # noqa: BLE001 - retry decision depends on the message
            message = str(exc).lower()
            transient = any(word in message for word in ("timeout", "rate", "connection"))
            if attempt < max_retries and transient:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")  # pragma: no cover


def parse_json_response(text: str):
    """Parse JSON that may be wrapped in a Markdown code fence or surrounded by prose."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def ask_json(
    client,
    model: str,
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
):
    """Ask for JSON; if the reply is not valid JSON, ask once more."""
    for attempt in range(2):
        raw = ask_llm(client, model, system, user, temperature=temperature, max_tokens=max_tokens)
        try:
            return parse_json_response(raw)
        except ValueError:
            if attempt == 1:
                raise
            user += "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object."
    raise RuntimeError("unreachable")  # pragma: no cover
