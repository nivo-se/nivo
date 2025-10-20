-- Multi-Model Valuation Database Schema
-- Creates tables for storing valuation models, assumptions, runs, and results

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Valuation Models (static configuration)
CREATE TABLE IF NOT EXISTS valuation_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Valuation Assumptions (admin-editable per industry/size/growth)
CREATE TABLE IF NOT EXISTS valuation_assumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_key TEXT NOT NULL REFERENCES valuation_models(key) ON DELETE CASCADE,
    industry TEXT,
    size_bucket TEXT, -- 'small' (<10M), 'medium' (10-50M), 'large' (>50M)
    growth_bucket TEXT, -- 'low' (<5%), 'medium' (5-15%), 'high' (>15%)
    
    -- Multiples for different models
    revenue_multiple DECIMAL(5,2),
    ebitda_multiple DECIMAL(5,2),
    earnings_multiple DECIMAL(5,2),
    
    -- DCF parameters
    discount_rate DECIMAL(5,4), -- e.g., 0.10 for 10%
    terminal_multiple DECIMAL(5,2),
    
    -- Net Debt assumptions
    net_debt_method TEXT DEFAULT 'zero', -- 'direct', 'ratio_revenue', 'ratio_ebitda', 'zero'
    net_debt_k DECIMAL(5,4), -- multiplier for ratio methods
    
    -- Range constraints
    range_min DECIMAL(5,2),
    range_max DECIMAL(5,2),
    
    -- Metadata
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combinations
    UNIQUE(model_key, industry, size_bucket, growth_bucket)
);

-- 3. Valuation Runs (links to analysis runs)
CREATE TABLE IF NOT EXISTS valuation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES ai_analysis_runs(id) ON DELETE CASCADE,
    company_orgnr TEXT NOT NULL,
    selected_model_key TEXT REFERENCES valuation_models(key),
    value_type TEXT DEFAULT 'equity' CHECK (value_type IN ('equity', 'ev')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one run per company per analysis
    UNIQUE(analysis_run_id, company_orgnr)
);

-- 4. Valuation Results (individual model outputs)
CREATE TABLE IF NOT EXISTS valuation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valuation_run_id UUID NOT NULL REFERENCES valuation_runs(id) ON DELETE CASCADE,
    model_key TEXT NOT NULL REFERENCES valuation_models(key),
    
    -- Both EV and Equity values
    value_ev DECIMAL(15,2), -- Enterprise Value in SEK
    value_equity DECIMAL(15,2), -- Equity Value in SEK
    
    -- Model details
    basis TEXT, -- e.g., "Revenue × 1.2x multiple"
    multiple_used DECIMAL(5,2),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    
    -- Inputs and assumptions used
    inputs JSONB, -- Store all inputs, assumptions, and calculations
    
    -- Optional notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one result per model per run
    UNIQUE(valuation_run_id, model_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_valuation_assumptions_lookup 
ON valuation_assumptions(model_key, industry, size_bucket, growth_bucket);

CREATE INDEX IF NOT EXISTS idx_valuation_runs_analysis 
ON valuation_runs(analysis_run_id);

CREATE INDEX IF NOT EXISTS idx_valuation_runs_company 
ON valuation_runs(company_orgnr);

CREATE INDEX IF NOT EXISTS idx_valuation_results_run 
ON valuation_results(valuation_run_id);

CREATE INDEX IF NOT EXISTS idx_valuation_results_model 
ON valuation_results(model_key);

-- Row Level Security (RLS) Policies
ALTER TABLE valuation_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for valuation_models (read-only for all users)
CREATE POLICY "Users can read valuation models" ON valuation_models
    FOR SELECT USING (true);

-- RLS Policies for valuation_assumptions (read for users, write for admins)
CREATE POLICY "Users can read valuation assumptions" ON valuation_assumptions
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage valuation assumptions" ON valuation_assumptions
    FOR ALL USING (public.is_admin());

-- RLS Policies for valuation_runs (user can only access their own runs)
CREATE POLICY "Users can access their own valuation runs" ON valuation_runs
    FOR ALL USING (
        analysis_run_id IN (
            SELECT id FROM ai_analysis_runs 
            WHERE initiated_by = auth.uid()::text
        )
    );

-- RLS Policies for valuation_results (user can only access their own results)
CREATE POLICY "Users can access their own valuation results" ON valuation_results
    FOR ALL USING (
        valuation_run_id IN (
            SELECT vr.id FROM valuation_runs vr
            JOIN ai_analysis_runs ar ON vr.analysis_run_id = ar.id
            WHERE ar.initiated_by = auth.uid()::text
        )
    );

-- Insert default valuation models
INSERT INTO valuation_models (key, name, description) VALUES
('revenue_multiple', 'Revenue Multiple', 'Enterprise Value = Revenue × Multiple'),
('ebitda_multiple', 'EBITDA Multiple', 'Enterprise Value = EBITDA × Multiple'),
('earnings_multiple', 'Earnings Multiple (PER)', 'Equity Value = Net Profit × Multiple'),
('dcf_lite', 'DCF-Lite', 'Discounted Cash Flow with simplified assumptions'),
('hybrid_score', 'Hybrid Score-Adjusted', 'Weighted combination of all models')
ON CONFLICT (key) DO NOTHING;

-- Insert default assumptions for common industries
INSERT INTO valuation_assumptions (model_key, industry, size_bucket, growth_bucket, revenue_multiple, ebitda_multiple, earnings_multiple, discount_rate, terminal_multiple, net_debt_method, net_debt_k) VALUES
-- Technology/SaaS companies
('revenue_multiple', 'Teknik', 'small', 'high', 2.5, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.1),
('revenue_multiple', 'Teknik', 'medium', 'high', 2.0, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.15),
('revenue_multiple', 'Teknik', 'large', 'high', 1.8, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.2),

('ebitda_multiple', 'Teknik', 'small', 'high', NULL, 12.0, NULL, NULL, NULL, 'ratio_revenue', 0.1),
('ebitda_multiple', 'Teknik', 'medium', 'high', NULL, 10.0, NULL, NULL, NULL, 'ratio_revenue', 0.15),
('ebitda_multiple', 'Teknik', 'large', 'high', NULL, 8.0, NULL, NULL, NULL, 'ratio_revenue', 0.2),

('earnings_multiple', 'Teknik', 'small', 'high', NULL, NULL, 15.0, NULL, NULL, 'ratio_revenue', 0.1),
('earnings_multiple', 'Teknik', 'medium', 'high', NULL, NULL, 12.0, NULL, NULL, 'ratio_revenue', 0.15),
('earnings_multiple', 'Teknik', 'large', 'high', NULL, NULL, 10.0, NULL, NULL, 'ratio_revenue', 0.2),

-- Manufacturing companies
('revenue_multiple', 'Tillverkning', 'small', 'medium', 1.2, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.2),
('revenue_multiple', 'Tillverkning', 'medium', 'medium', 1.0, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.25),
('revenue_multiple', 'Tillverkning', 'large', 'medium', 0.8, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.3),

('ebitda_multiple', 'Tillverkning', 'small', 'medium', NULL, 6.0, NULL, NULL, NULL, 'ratio_revenue', 0.2),
('ebitda_multiple', 'Tillverkning', 'medium', 'medium', NULL, 5.0, NULL, NULL, NULL, 'ratio_revenue', 0.25),
('ebitda_multiple', 'Tillverkning', 'large', 'medium', NULL, 4.0, NULL, NULL, NULL, 'ratio_revenue', 0.3),

('earnings_multiple', 'Tillverkning', 'small', 'medium', NULL, NULL, 8.0, NULL, NULL, 'ratio_revenue', 0.2),
('earnings_multiple', 'Tillverkning', 'medium', 'medium', NULL, NULL, 6.0, NULL, NULL, 'ratio_revenue', 0.25),
('earnings_multiple', 'Tillverkning', 'large', 'medium', NULL, NULL, 5.0, NULL, NULL, 'ratio_revenue', 0.3),

-- DCF assumptions (same across industries for now)
('dcf_lite', NULL, NULL, NULL, NULL, NULL, NULL, 0.10, 8.0, 'ratio_revenue', 0.2),

-- Hybrid model (uses weighted average of above)
('hybrid_score', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ratio_revenue', 0.2)
ON CONFLICT (model_key, industry, size_bucket, growth_bucket) DO NOTHING;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_valuation_models_updated_at 
    BEFORE UPDATE ON valuation_models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_valuation_assumptions_updated_at 
    BEFORE UPDATE ON valuation_assumptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
