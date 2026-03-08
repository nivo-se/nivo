Below is the Agent Failure Map for the Nivo research platform.

This is the production view of where agentic research systems actually fail, even when the architecture looks good on paper. It is especially relevant to Nivo because your source architecture depends on a multi-step chain from company profiling through valuation and report generation, with public-source retrieval and source-backed claims.  ￼ The Bruno Mathsson example also shows why these failure points matter: the final memo mixes narrative, market estimates, competitor benchmarks, value-creation assumptions, financial projections, and valuation into one coherent document, so errors in early stages propagate into the whole report.  ￼

⸻

Agent Failure Map

flowchart TD
    A[1. Wrong Company Identity] --> B[2. Bad Retrieval]
    B --> C[3. Weak Extraction]
    C --> D[4. Wrong Market Framing]
    D --> E[5. Bad Competitor Set]
    E --> F[6. Generic Strategy Output]
    F --> G[7. Unreliable Value Creation Logic]
    G --> H[8. Weak Financial Model Assumptions]
    H --> I[9. Unsupported Valuation]
    I --> J[10. Hallucinated Final Report]


⸻

1. Wrong Company Identity

What fails

The system mixes up:
	•	similar company names
	•	wrong legal entity
	•	wrong website/domain
	•	Swedish operating company vs holding company

Why this breaks everything

If identity is wrong, then:
	•	retrieval is wrong
	•	competitors are wrong
	•	market analysis is wrong
	•	valuation becomes meaningless

Typical symptom

The report looks polished but is about the wrong business.

Mitigation
	•	create a strict Entity Resolution step
	•	require:
	•	org number
	•	canonical legal name
	•	detected domain
	•	aliases
	•	block the run if identity confidence is too low
	•	store a manual override field in UI

Required control

identity_confidence >= threshold before research starts

⸻

2. Bad Retrieval

What fails

Search finds:
	•	SEO spam
	•	irrelevant listicles
	•	stale articles
	•	aggregator junk
	•	unrelated companies

This is a major risk because the original Nivo design intentionally relies on dynamic public web gathering rather than a fixed source set.  ￼

Why this breaks everything

LLMs are often “too helpful” and will build plausible analysis from weak evidence.

Typical symptom

The agent produces detailed output with low-quality sources.

Mitigation
	•	use source ranking:
	•	primary company site
	•	filings / registries
	•	reputable media
	•	credible industry reports
	•	only then broader web
	•	cap top-N search results
	•	cache search results by query + company + stage
	•	use query templates, not free-form search chaos
	•	add source credibility score at ingestion

Required control

Every retrieved document gets:
	•	source_type
	•	publisher_score
	•	recency_score
	•	relevance_score

⸻

3. Weak Extraction

What fails

The scraper or parser extracts:
	•	wrong text blocks
	•	missing numbers
	•	navigation junk
	•	duplicated fragments
	•	partial tables

Why this breaks everything

Even good sources become unusable if parsed badly.

Typical symptom

Agent says “unknown” too often, or worse, infers numbers that were never actually present.

Mitigation
	•	separate retrieval from extraction
	•	use:
	•	HTML cleaner
	•	boilerplate removal
	•	PDF parser
	•	table extractor where needed
	•	store raw artifact + extracted text + extraction metadata
	•	run extraction tests on known example pages

Required control

Each extracted field should track:
	•	extraction method
	•	source span/snippet
	•	confidence

⸻

4. Wrong Market Framing

What fails

The system chooses the wrong market category.

Example:
	•	labels a niche premium design brand as “general furniture”
	•	uses global broad market estimates that are too loose to be decision-useful

The Bruno Mathsson memo works because it frames the company within a specific premium/design-heritage furniture context rather than a generic broad category.  ￼

Why this breaks everything

Then:
	•	TAM is misleading
	•	growth rates are misleading
	•	competitor universe is wrong
	•	value-creation opportunities become generic

Typical symptom

The report says true-sounding but strategically useless things.

Mitigation
	•	separate:
	•	broad industry
	•	investable niche
	•	actual operating segment
	•	force the market agent to return:
	•	primary segment
	•	secondary segments
	•	justification
	•	confidence
	•	allow human override of market category

Required control

Market output must include:
	•	industry_label
	•	niche_label
	•	justification
	•	confidence

⸻

5. Bad Competitor Set

What fails

The system picks:
	•	aspirational brands instead of true comparables
	•	distributors instead of producers
	•	global giants instead of operational peers
	•	companies in adjacent but non-comparable niches

This is especially important because competitor discovery is central in the Nivo flow and competitor lists are meant to propagate through the whole report and be editable by users.  ￼

Why this breaks everything

Bad peers ruin:
	•	positioning analysis
	•	margin benchmarking
	•	export benchmarking
	•	valuation multiples

Typical symptom

The company looks artificially strong or artificially weak.

Mitigation

Use a two-layer competitor model:
	1.	True operating comparables
	2.	Brand/positioning comparables

Add scoring dimensions:
	•	product overlap
	•	price point similarity
	•	geography overlap
	•	customer overlap
	•	manufacturing / business model similarity

Required control

Every competitor must have:
	•	similarity score
	•	comparable type
	•	source evidence
	•	include/exclude rationale

⸻

6. Generic Strategy Output

What fails

The strategy agent outputs boilerplate:
	•	“strong brand”
	•	“growth opportunities”
	•	“competition risk”
	•	“digital transformation potential”

The Nivo design explicitly wants non-generic SWOT and deeper operational insight.  ￼

Why this breaks everything

A generic SWOT is worse than no SWOT because it gives fake confidence.

Typical symptom

The report reads like consultant filler text.

Mitigation

Force each strategic point to include:
	•	evidence
	•	mechanism
	•	implication

Example structure:
	•	Observation
	•	Why it matters
	•	Operational consequence
	•	Source support

Required control

Ban unsupported generic phrases in prompt validation.

⸻

7. Unreliable Value Creation Logic

What fails

The system jumps from “interesting company” to exaggerated initiatives:
	•	launch D2C
	•	expand internationally
	•	improve procurement
	•	digitize CRM
without checking operational feasibility

The Bruno Mathsson memo is useful because value creation is tied to concrete levers like D2C, international expansion, archive activation, procurement and digitalization, not just generic growth language.  ￼

Why this breaks everything

The investment thesis becomes fantasy.

Typical symptom

Every company gets the same 4–5 initiatives.

Mitigation

Each initiative must include:
	•	prerequisite capabilities
	•	expected timeline
	•	capital intensity
	•	required people/system changes
	•	evidence that peer companies or market structure support it

Required control

Initiatives need structured fields:
	•	initiative
	•	driver_type
	•	required_capabilities
	•	time_to_impact
	•	capital_need
	•	risk_score

⸻

8. Weak Financial Model Assumptions

What fails

The model turns soft qualitative ideas into precise numbers without discipline.

Examples:
	•	growth too high
	•	margins expand too fast
	•	working capital magically improves
	•	capex ignored

The Nivo architecture already envisions 7-year projections with sourced assumptions and comments; the failure is when those assumptions are not bounded or translated into deterministic logic.  ￼

Why this breaks everything

This is where impressive-looking reports become economically unreliable.

Typical symptom

The output feels “spreadsheety” but is not defensible.

Mitigation

Use a code-first deterministic model:
	•	no LLM math
	•	LLM may propose assumptions
	•	Python engine computes outputs

Bound assumptions by:
	•	history
	•	peer ranges
	•	market growth
	•	operational constraints

Required control

Every assumption must carry:
	•	value
	•	rationale
	•	bound type
	•	source/evidence
	•	human-adjustable flag

⸻

9. Unsupported Valuation

What fails

Valuation uses:
	•	bad peer set
	•	inappropriate multiple
	•	fake transaction comps
	•	over-precise EV range

The reference memo shows valuation as the final synthesis of operating case, peer multiples, structure, downside support, and return logic, not just one formula.  ￼

Why this breaks everything

Users often trust the valuation page most.

Typical symptom

The valuation is numerically neat but conceptually weak.

Mitigation
	•	split valuation into:
	•	base operating value
	•	sensitivity table
	•	peer range
	•	scenario commentary
	•	disclose uncertainty clearly
	•	never present one exact number when public data is weak

Required control

Valuation must include:
	•	methodology label
	•	peer list
	•	peer quality score
	•	sensitivity matrix
	•	uncertainty note

⸻

10. Hallucinated Final Report

What fails

The report generator smooths over missing data and contradictions.

Why this is the most dangerous failure

By the final stage, the document is polished enough that weak evidence is hard to spot.

Typical symptom

A beautiful memo with unsupported claims.

Mitigation
	•	report generator may only consume:
	•	verified structured objects
	•	verified claims
	•	unsupported claims must be:
	•	excluded
	•	or explicitly labeled as uncertain
	•	show source references inline in UI

Required control

No narrative paragraph should be emitted unless its supporting claims passed verification.

⸻

Failure Severity Matrix

quadrantChart
    title Nivo Agent Failure Severity
    x-axis Low Impact --> High Impact
    y-axis Low Frequency --> High Frequency
    quadrant-1 Watch Closely
    quadrant-2 Critical
    quadrant-3 Minor
    quadrant-4 Operational
    "Wrong Company Identity": [0.9, 0.8]
    "Bad Retrieval": [0.8, 0.9]
    "Weak Extraction": [0.7, 0.8]
    "Wrong Market Framing": [0.8, 0.7]
    "Bad Competitor Set": [0.8, 0.85]
    "Generic Strategy Output": [0.6, 0.9]
    "Unreliable Value Creation Logic": [0.85, 0.75]
    "Weak Financial Model Assumptions": [0.95, 0.8]
    "Unsupported Valuation": [0.95, 0.7]
    "Hallucinated Final Report": [1.0, 0.75]


⸻

Production Safeguards Map

Stage-by-stage controls

Before retrieval
	•	identity verification
	•	canonical company object
	•	manual override support

During retrieval
	•	ranked sources
	•	query limits
	•	caching
	•	dedupe
	•	artifact persistence

During extraction
	•	deterministic parsers first
	•	LLM fallback only when needed
	•	extraction span capture

During synthesis
	•	structured output only
	•	no free-form narrative until verification

During modeling
	•	deterministic formulas
	•	bounded assumptions
	•	scenario ranges

Before report generation
	•	claim-level verification
	•	unsupported claim blocking
	•	confidence thresholds

⸻

Human-in-the-Loop Escalation Points

You should explicitly route to analyst review when:
	1.	identity confidence is low
	2.	market category ambiguity is high
	3.	competitor set confidence is low
	4.	financial assumptions exceed peer/history bounds
	5.	valuation relies on poor-quality comps
	6.	too many unsupported claims remain

That fits your overall target of 80% automation and 20% human review from the original system philosophy.  ￼

⸻

Recommended Build Order to Reduce Failure Risk

If you want to avoid the most expensive mistakes, build in this order:
	1.	Entity Resolution
	2.	Retrieval + source storage
	3.	Extraction pipeline
	4.	Verification layer
	5.	Competitor system
	6.	Strategy/value creation
	7.	Financial model
	8.	Valuation
	9.	Report generator

This is slightly different from the user-facing report flow, but it is the right engineering order because it reduces compounding error risk.

⸻

The 3 Most Dangerous Failure Points for Nivo

If I had to prioritize only three, they are:

1. Bad competitor set

Because it poisons strategy, benchmarking, projections, and valuation.

2. Weak financial assumptions

Because this creates false precision and fake conviction.

3. Hallucinated synthesis

Because polished output hides weak evidence.

⸻

What to build next

The next most useful file is:

retrieval-system-design.md

That should define:
	•	search query templates
	•	ranking rules
	•	fetch/render pipeline
	•	extraction pipeline
	•	source credibility model
	•	verification inputs

That file will turn the current architecture into something your team can actually implement cleanly in Cursor.

If you want, I’ll generate that full retrieval-system-design.md next.