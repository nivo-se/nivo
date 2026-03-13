# 08. UX Workflow

## Objective

The UX should make deep research feel like a staged analytical operating system, not a blank AI prompt.

The workflow should stay light for users while exposing:
- what is being run
- what is blocked
- what confidence level exists
- what the report currently knows

## Three-part UX structure

### 1. Deep Research Home
The operating hub.

**Contains**
- New report CTA
- report list
- queue/status overview
- recent runs
- confidence/status badges
- search/filter

### 2. Launch Flow
A smart, minimal modal or drawer.

**Required inputs**
- company search / org number
- research mode
- optional analyst note

**Advanced accordion**
- include valuation
- strict evidence gating
- prioritize market analysis
- prioritize competitor analysis
- refresh vs reuse cached evidence

### 3. Run Workspace
A dedicated page for one report run.

**Layout**
- left rail: stage progression
- main panel: active output, blockers, evidence summary, report sections

## Recommended launch steps

### Step 1: Select company
Support:
- internal company search
- org number lookup
- manual fallback entry

### Step 2: Choose mode
- Quick Screen
- Standard Deep Research
- Full IC Prep

### Step 3: Analyst context
Optional note such as:
- “Assess buy-and-build attractiveness”
- “Focus on fragmentation and margin improvement”
- “Check whether valuation should be omitted if evidence is weak”

### Step 4: Preflight
Show readiness summary:
- financials found
- website found
- market niche confidence
- likely evidence strength
- prior report exists

### Step 5: Run
Launch and redirect to run workspace.

## Run workspace states

### Running
Show:
- current stage
- stage description
- evidence counts
- top extracted facts
- live logs or status notes

### Blocked
Show:
- stage name
- blocker reason
- suggested next actions
- rerun options

### Complete
Show:
- report summary
- sections
- citations
- confidence summary
- rerun controls

## Stage rail

Suggested stages:
1. Company resolution
2. Financial grounding
3. Company understanding
4. Report spec
5. Web intelligence
6. Competitors
7. Market synthesis
8. Assumption registry
9. Valuation
10. Final report

## UI copy principles

- state what is happening
- state what is missing
- state what confidence exists
- avoid pretending certainty
- avoid generic “failed” messaging

## Frontend entities

### ResearchTemplate
Saved mode/preset.

### ResearchRun
Concrete execution instance.

### ResearchReport
Assembled report artifact.

## MVP scope

For the first UX release, build:
- home page
- launch modal
- run workspace
- blocked-state UX
- stage rail
- report section viewer

Do not build:
- a giant workflow builder
- policy editing UI
- freeform prompt-driven report generation
