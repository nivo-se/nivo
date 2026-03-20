# Agents SDK Integration Patterns

This document defines how the OpenAI Agents SDK interfaces with Nivo's Deep Research components: `RunStateRepository`, `AgentContext`, and stage validators. It supports the pilot and future migration of agents to the SDK.

## 1. Agent Interface Contract

All research agents (including Agents SDK–powered ones) must implement:

```python
def run(self, context: AgentContext) -> AgentOutput:
    ...
```

- **Input:** `AgentContext` from `RunStateRepository.build_agent_context(run_id, company_id)`
- **Output:** A Pydantic model (e.g. `MarketAnalysisAgentOutput`) that matches the stage schema

## 2. RunStateRepository Integration

`RunStateRepository` in `backend/orchestrator/persistence.py` provides:

- `build_agent_context(run_id, company_id)` → `AgentContext` with sources, chunks, company metadata
- `persist_claims(...)` → stores claims with `claim_type` and source linkage
- `persist_*` methods for each stage (e.g. `persist_market_analysis`)

**Agents SDK agents** receive the same `AgentContext` as heuristic agents. They must:

1. Call `context.joined_text(max_chars=...)` for evidence
2. Return an output that serializes to the expected schema
3. Include `source_ids` from `context.sources` for traceability

The orchestrator does not change: it still calls `agent.run(context)` and passes the result to `persist_*`.

## 3. AgentContext Usage

| Field / Method        | Purpose for Agents SDK |
|-----------------------|------------------------|
| `context.joined_text(max_chars)` | Primary evidence input for the agent prompt |
| `context.company_name`           | Company identifier in prompts |
| `context.sources`                | Source records for `source_ids` and evidence refs |
| `context.chunks`                 | Chunk records for evidence excerpts |
| `context.primary_source()`       | First source for `SourceEvidence` |
| `context.primary_chunk()`        | First chunk for excerpt |

Agents SDK agents should not call external APIs beyond the SDK (e.g. no direct Tavily). Evidence comes from `AgentContext`.

## 4. Stage Validators

Stage validators in `backend/orchestrator/stage_validators.py` receive the **output dict** (from `model_dump(mode="json")`). They do not care whether the agent was heuristic or Agents SDK.

**Requirements for Agents SDK outputs:**

- Same schema as the heuristic agent (e.g. `MarketAnalysisAgentOutput`)
- `claims` with `claim_type`, `confidence`, `evidence` (SourceEvidence)
- `source_ids` list for provenance

If validation fails, the orchestrator retries (up to `MAX_STAGE_RETRIES`). Agents SDK agents should handle parse errors and return a fallback output rather than raising.

## 5. Configuration and Toggle

| Setting                               | Env Var                               | Purpose |
|--------------------------------------|----------------------------------------|---------|
| `use_openai_agent_for_market_analysis` | `USE_OPENAI_AGENT_FOR_MARKET_ANALYSIS` | Use Agents SDK for `market_analysis` when `true` |
| `web_retrieval_search_provider`       | `WEB_RETRIEVAL_SEARCH_PROVIDER`        | `tavily` (default) or `openai` for A/B test |

The registry (`AgentRegistry.default()`) reads settings at startup and registers the appropriate agent implementation.

## 6. Usage Tracking

Agents SDK returns usage via `result.context_wrapper.usage`:

- `input_tokens`, `output_tokens`, `total_tokens`
- `requests` (number of API calls)

The pilot `MarketAnalysisAgentOpenAI` stores this in `metadata["agent_usage"]` for cost and latency comparison.

## 7. Error Handling

- **ImportError** (openai-agents not installed): Return fallback output, log warning
- **API / Runner failure**: Return fallback output, log warning
- **Invalid JSON output**: Return fallback output, log warning

Fallback output should have low confidence and a claim indicating the failure, so downstream stages and validators can degrade gracefully.

## 8. Adding More Agents SDK Agents

To migrate another agent (e.g. `company_profile`):

1. Create `backend/agents/<name>_agent_openai.py` with `run(context) -> AgentOutput`
2. Add `use_openai_agent_for_<name>: bool` to `AppSettings`
3. In `AgentRegistry.default()`, conditionally register the OpenAI implementation
4. Ensure output schema matches the existing agent and stage validator
5. Add fallback behavior for SDK/API failures
