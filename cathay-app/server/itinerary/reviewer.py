"""Agent 4: Quality Check. Plain-rule checks plus a model review of the draft."""
import json

from . import config
from .checks import deterministic_checks
from .llm import AgentError, ask_json
from .schedule import render_schedule

SYSTEM = (
    "You are the Quality Check agent for Cathay Together. You validate group travel itineraries for "
    "correctness, feasibility, and fairness. Return only valid JSON, without commentary.\n" + config.EVIDENCE_RULES
)

REVIEW_FORMAT = """{
  "approved": true,
  "issues": [{"severity": "error|warning", "day": 1, "message": "What is wrong", "suggested_fix": "How to fix it"}],
  "suggestions": ["Optional improvement"],
  "summary": "One short paragraph overall assessment"
}"""


def _model_review(llm, model, context, schedule, cards, sources, rule_issues) -> dict:
    evidence = [{"id": s["id"], "title": s["title"], "excerpt": s["excerpt"][:800]} for s in sources]
    liked = [
        {k: c[k] for k in ("id", "name", "opening_hours", "closed_days", "like_count", "total_members", "source_ids")}
        for c in cards
        if c["like_count"] > 0
    ]
    result = ask_json(
        llm,
        model,
        SYSTEM,
        f"""
CONTEXT:
Destination: {context['destination']}
Dates: {context['dates']['start']} to {context['dates']['end']}
Group size: {context['group_size']}
Budget: ¥{context.get('budget_per_person', config.DEFAULT_BUDGET_PER_PERSON)}/person
Pace: {context.get('pace', 'moderate')}
Flights: {json.dumps(context.get('flights', []), ensure_ascii=False)}

DRAFT ITINERARY (24h local times):
{render_schedule(schedule, cards)}

ACTIVITIES THE GROUP LIKED:
{json.dumps(liked, ensure_ascii=False)}

EVIDENCE:
{json.dumps(evidence, ensure_ascii=False)}

PROBLEMS ALREADY FOUND BY AUTOMATIC CHECKS (do not repeat these):
{json.dumps([i['message'] for i in rule_issues], ensure_ascii=False)}

Check only what the automatic checks cannot see:
1. TRAVEL FEASIBILITY: is about 30 minutes realistic between neighbourhoods used back to back?
2. UNSUPPORTED CLAIMS: prices or hours in the plan that the evidence does not support.
3. FAIRNESS: is an activity most of the group liked included whenever it fits?
4. GEOGRAPHY: are the activities on one day reasonably close together?

Return ONLY valid JSON:
{REVIEW_FORMAT}

Use severity "error" only for real infeasibility or unsupported facts; otherwise "warning".
""",
        temperature=0.2,
    )
    return result if isinstance(result, dict) else {}


def _clean_issue(raw) -> dict | None:
    if not isinstance(raw, dict) or not isinstance(raw.get("message"), str):
        return None
    day = raw.get("day")
    return {
        "severity": "error" if raw.get("severity") == "error" else "warning",
        "day": day if isinstance(day, int) and not isinstance(day, bool) else None,
        "message": raw["message"][:300],
        "suggested_fix": str(raw.get("suggested_fix") or "")[:300],
    }


def quality_check_agent(llm, model, context, schedule, cards, sources) -> dict:
    """Return {approved, issues, suggestions, summary}. Any 'error' issue means not approved."""
    rule_issues = deterministic_checks(schedule, cards, context)
    review = _model_review(llm, model, context, schedule, cards, sources, rule_issues)
    if not isinstance(review.get("approved"), bool):
        raise AgentError("The itinerary review was incomplete. Try again.")
    raw_issues = review.get("issues") if isinstance(review.get("issues"), list) else []
    seen = {i["message"] for i in rule_issues}
    model_issues = [i for i in map(_clean_issue, raw_issues) if i and i["message"] not in seen]
    issues = sorted(rule_issues + model_issues, key=lambda issue: issue["severity"] != "error")
    suggestions = review.get("suggestions") if isinstance(review.get("suggestions"), list) else []
    summary = review.get("summary") if isinstance(review.get("summary"), str) else ""
    approved = review["approved"] and not any(i["severity"] == "error" for i in issues)
    return {
        "approved": approved,
        "issues": issues[:12],
        "suggestions": [str(s)[:200] for s in suggestions][:5],
        "summary": summary[:600] or ("The plan passed all checks." if approved else "The plan has problems to fix."),
    }


def feedback_text(review: dict) -> str:
    return "\n".join(
        f"- [{i['severity'].upper()}] Day {i['day'] or '?'}: {i['message']} -> Fix: {i['suggested_fix']}"
        for i in review["issues"]
    )
