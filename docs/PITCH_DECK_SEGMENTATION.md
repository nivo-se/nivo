# Pitch Deck: Nivo Segmentation Methodology

## Slide 1: Data-Driven Target Identification

### The Challenge
Finding high-quality acquisition targets from **13,000+ Swedish companies** is like finding a needle in a haystack. Traditional methods rely on manual research, gut feeling, and incomplete data.

### Our Solution
**Nivo's AI-Powered Segmentation System** uses financial data and machine learning to automatically identify and rank the best acquisition targets.

### The Result
- **300 Tier 1-3 companies** identified from 13,000+ candidates
- **100 top-priority targets** (Tier 1) ready for immediate outreach
- **Data-driven prioritization** based on fit and operational upside potential

---

## Slide 2: Our Segmentation Methodology

### Three-Stage Filtering Funnel

```
13,609 Companies (Initial Dataset)
    ↓
Stage 1: Industry Filtering
    ↓
8,133 Companies (40% reduction)
    ↓
Stage 2: Financial Scoring
    ↓
8,133 Companies Scored
    ↓
Stage 3: Tier Assignment
    ↓
300 Tier 1-3 Companies
    (100 per tier)
```

### Stage 1: Industry Filtering
**Exclude non-target industries**:
- Restaurants, Hotels, Catering
- Retail (Detaljhandel, Butikshandel)
- Food Wholesale
- Staffing Agencies
- Travel Agencies
- And 20+ other sectors

**Result**: 8,133 companies remain (40% reduction)

### Stage 2: Financial Scoring
Each company receives two composite scores:

1. **Fit Score (0-100)**: How well the company matches acquisition criteria
   - Size (0-40): Revenue in sweet spot (70-150 MSEK)
   - Profitability (0-30): Moderate EBITDA margins (5-15%)
   - Stability (0-30): Healthy growth (2-15%) and equity ratio (25-60%)

2. **Ops Upside Score (0-100)**: Operational improvement potential
   - Margin headroom (0-50): Room to improve profitability
   - Margin trend (0-25): Margins not improving vs historical
   - Growth vs margin (0-25): Growth potential with margin headroom

**Total Score (0-200)**: Combined metric for prioritization

### Stage 3: Tier Assignment
Companies ranked by fit_score, then total_score, then ops_score:
- **Tier 1** (top 100): Best fit + highest upside
- **Tier 2** (next 100): Strong fit + good upside
- **Tier 3** (next 100): Good fit + moderate upside

---

## Slide 3: Scoring Framework & Results

### Scoring Components

#### Fit Score (0-100 points)
**Size Component (0-40 points)**:
- Continuous scoring based on revenue (50-200 MSEK range)
- Sweet spot: 70-150 MSEK gets highest scores
- Ensures companies are right-sized for acquisition

**Profitability Component (0-30 points)**:
- Continuous scoring based on EBITDA margin
- Optimal: 5-15% margin (indicates room for improvement)
- Penalties for extremes (too low = risky, too high = may be optimized)

**Stability Component (0-30 points)**:
- Growth rate (2-15% CAGR optimal)
- Equity ratio (25-60% optimal)
- Rewards stable, well-capitalized companies

#### Ops Upside Score (0-100 points)
**Margin Headroom (0-50 points)**:
- Companies with 3-12% EBITDA margin have most improvement potential
- Too low = risky, too high = already optimized

**Margin Trend (0-25 points)**:
- Rewards companies where margins aren't improving
- Indicates operational inefficiencies that can be fixed

**Growth vs Margin (0-25 points)**:
- Rewards growing companies with margin headroom
- Indicates scalable business model

### Current Results

**Distribution**:
- **Tier 1**: 100 companies (avg fit: 62.8, avg ops: 69.7)
- **Tier 2**: 100 companies (avg fit: 61.2, avg ops: 67.4)
- **Tier 3**: 100 companies (avg fit: 60.1, avg ops: 67.3)
- **Unsegmented**: 7,833 companies (fit_score < 60)

**Key Metrics**:
- Fit scores range: 30-65 points (wide distribution)
- Average fit score: 47.6 points
- Top tier companies have 30%+ higher scores than average

### Why This Works

1. **Data-Driven**: No guesswork - pure financial analysis
2. **Scalable**: Can process thousands of companies automatically
3. **Objective**: Consistent scoring criteria applied to all companies
4. **Actionable**: Clear tier assignment enables focused outreach
5. **Continuous Improvement**: Scores can be recalculated as new data arrives

### Next Steps

1. **Tier 1 Outreach**: Focus on top 100 companies first
2. **Tier 2-3 Pipeline**: Maintain pipeline of next 200 companies
3. **Data Refresh**: Recalculate scores quarterly as new financials arrive
4. **Model Refinement**: Adjust thresholds based on deal outcomes

---

## Visual Flow Diagram (For Slide 2)

```
┌─────────────────────────────────────┐
│  13,609 Swedish Companies           │
│  (Allabolag Scraped Data)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Stage 1: Industry Filtering        │
│  • Exclude restaurants, retail, etc│
│  • Keep: Tech, Manufacturing, etc   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8,133 Companies                    │
│  (40% reduction)                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Stage 2: Financial Scoring         │
│  • Fit Score (0-100)                │
│  • Ops Upside Score (0-100)         │
│  • Total Score (0-200)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8,133 Companies Scored             │
│  (Wide distribution: 30-65 points)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Stage 3: Tier Assignment           │
│  • Rank by fit_score DESC           │
│  • Assign tiers 1-3                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  300 Tier 1-3 Companies             │
│  • Tier 1: 100 companies            │
│  • Tier 2: 100 companies            │
│  • Tier 3: 100 companies            │
└─────────────────────────────────────┘
```

---

## Key Talking Points

1. **Scale**: Processed 13,609 companies → identified 300 targets
2. **Efficiency**: 40% reduction in first stage, then precise scoring
3. **Quality**: Top tier companies score 30%+ higher than average
4. **Science**: Continuous scoring provides better differentiation than buckets
5. **Action**: Clear tier assignment enables focused, prioritized outreach

