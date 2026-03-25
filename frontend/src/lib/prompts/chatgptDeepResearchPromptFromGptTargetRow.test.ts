import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GptTargetCompanyRow } from "@/lib/api/gptTargetUniverse/service";
import { buildChatgptDeepResearchPrompt } from "./chatgptDeepResearchPromptFromGptTargetRow.ts";

describe("buildChatgptDeepResearchPrompt", () => {
  it("includes company input, PE analyst framing, workflow steps, and supplementary text (no raw triage JSON)", () => {
    const row: GptTargetCompanyRow = {
      orgnr: "556677-8899",
      company_name: "TestCo AB",
      rank: 1,
      gpt_official_website_url: "https://example.com",
      about_fetch_status: "ok",
      llm_triage_at: "2025-01-01T00:00:00Z",
      is_fit_for_nivo: true,
      fit_confidence: 0.85,
      blended_score: 0.72,
      stage1_total_score: 80,
      business_type: "B2B SaaS",
      operating_model: "Subscription",
      reason_summary: "Strong product-market fit in niche.",
      triage: { foo: "bar", secret: "should-not-appear" },
    };
    const s = buildChatgptDeepResearchPrompt(row);
    assert.match(s, /556677-8899/);
    assert.match(s, /TestCo AB/);
    assert.match(s, /example\.com/);
    assert.match(s, /senior private equity/);
    assert.match(s, /Step 1 — Identity Validation/);
    assert.match(s, /Step 9 — Investment View/);
    assert.match(s, /Strong product-market fit in niche/);
    assert.match(s, /B2B SaaS/);
    assert.ok(!s.includes("```json"));
    assert.ok(!s.includes('"foo"'));
    assert.ok(!s.includes("secret"));
    assert.ok(!s.includes("STRUCTURED EXTRACTION"));
    assert.ok(!/nivo/i.test(s), "prompt must not mention the product name");
    assert.ok(!s.includes("0.85"), "scores must not appear in prompt");
    assert.ok(!s.includes("0.72"), "scores must not appear in prompt");
  });

  it("works with minimal row (no supplementary block)", () => {
    const row: GptTargetCompanyRow = {
      orgnr: "111111-1111",
      company_name: null,
      rank: null,
      gpt_official_website_url: null,
      about_fetch_status: null,
      llm_triage_at: null,
      is_fit_for_nivo: null,
      fit_confidence: null,
      blended_score: null,
      stage1_total_score: null,
      business_type: null,
      operating_model: null,
      reason_summary: null,
      triage: null,
    };
    const s = buildChatgptDeepResearchPrompt(row);
    assert.match(s, /111111-1111/);
    assert.match(s, /Company: Unknown/);
    assert.match(s, /Website: unknown/);
    assert.ok(!s.includes("## SUPPLEMENTARY CONTEXT"));
    assert.ok(!s.includes("```json"));
  });
});
