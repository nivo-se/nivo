-- Normalized financial accounts schema for local SQLite database
-- This schema mirrors database/financial_accounts_schema.sql but uses
-- SQLite-compatible types (TEXT, REAL) and syntax.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    financial_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    year INTEGER NOT NULL,
    period TEXT NOT NULL,
    account_code TEXT NOT NULL,
    amount_sek REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT fk_financial_accounts_financial
        FOREIGN KEY (financial_id) REFERENCES company_financials(id) ON DELETE CASCADE,
    CONSTRAINT fk_financial_accounts_company
        FOREIGN KEY (orgnr) REFERENCES companies(orgnr) ON DELETE CASCADE,
    CONSTRAINT uq_financial_accounts_code UNIQUE (financial_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_orgnr_year
    ON financial_accounts (orgnr, year DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_code
    ON financial_accounts (account_code);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_code_year
    ON financial_accounts (account_code, year DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_financial_id
    ON financial_accounts (financial_id);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_orgnr_code_year
    ON financial_accounts (orgnr, account_code, year DESC);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_year_period
    ON financial_accounts (year DESC, period);

CREATE VIEW IF NOT EXISTS financial_accounts_pivot AS
SELECT
    fa.orgnr,
    fa.year,
    fa.period,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) AS revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) AS ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) AS profit_sek,
    MAX(CASE WHEN fa.account_code = 'EBITDA' THEN fa.amount_sek END) AS ebitda_sek,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) AS equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) AS debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) AS total_assets_sek,
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) AS employees,
    MAX(CASE WHEN fa.account_code = 'EKA' THEN fa.amount_sek END) AS equity_ratio,
    MAX(CASE WHEN fa.account_code = 'avk_eget_kapital' THEN fa.amount_sek END) AS roe_pct,
    MAX(CASE WHEN fa.account_code = 'avk_totalt_kapital' THEN fa.amount_sek END) AS roa_pct
FROM financial_accounts fa
GROUP BY fa.orgnr, fa.year, fa.period;

-- Note: SQLite does not auto-generate UUIDs. When inserting rows, ensure a
-- deterministic ID (e.g., use the parent financial_id plus account_code).
-- SQLite schema for normalized financial accounts
-- Run via: sqlite3 data/new_schema_local.db < database/financial_accounts_schema_sqlite.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    financial_id TEXT NOT NULL,
    orgnr TEXT NOT NULL,
    year INTEGER NOT NULL,
    period TEXT NOT NULL,
    account_code TEXT NOT NULL,
    amount_sek REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (financial_id) REFERENCES company_financials(id) ON DELETE CASCADE,
    FOREIGN KEY (orgnr) REFERENCES companies(orgnr) ON DELETE CASCADE
);

-- Unique constraint ensuring one account code per financial statement
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_unique
    ON financial_accounts(financial_id, account_code);

-- Common query pattern indexes
CREATE INDEX IF NOT EXISTS financial_accounts_orgnr_year_idx
    ON financial_accounts(orgnr, year);

CREATE INDEX IF NOT EXISTS financial_accounts_account_code_idx
    ON financial_accounts(account_code);

CREATE INDEX IF NOT EXISTS financial_accounts_account_code_year_idx
    ON financial_accounts(account_code, year);

CREATE INDEX IF NOT EXISTS financial_accounts_financial_id_idx
    ON financial_accounts(financial_id);

CREATE INDEX IF NOT EXISTS financial_accounts_orgnr_code_year_idx
    ON financial_accounts(orgnr, account_code, year);

CREATE INDEX IF NOT EXISTS financial_accounts_year_period_idx
    ON financial_accounts(year, period);

-- Pivot view for frequently used metrics (matches PostgreSQL view shape)
CREATE VIEW IF NOT EXISTS financial_accounts_pivot AS
SELECT
    fa.orgnr,
    fa.year,
    fa.period,
    MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) AS revenue_sek,
    MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) AS ebit_sek,
    MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) AS profit_sek,
    MAX(CASE WHEN fa.account_code = 'EBITDA' THEN fa.amount_sek END) AS ebitda_sek,
    MAX(CASE WHEN fa.account_code = 'EK' THEN fa.amount_sek END) AS equity_sek,
    MAX(CASE WHEN fa.account_code = 'FK' THEN fa.amount_sek END) AS debt_sek,
    MAX(CASE WHEN fa.account_code = 'SV' THEN fa.amount_sek END) AS total_assets_sek,
    MAX(CASE WHEN fa.account_code = 'ANT' THEN fa.amount_sek END) AS employees,
    MAX(CASE WHEN fa.account_code = 'EKA' THEN fa.amount_sek END) AS equity_ratio,
    MAX(CASE WHEN fa.account_code = 'avk_eget_kapital' THEN fa.amount_sek END) AS roe_pct,
    MAX(CASE WHEN fa.account_code = 'avk_totalt_kapital' THEN fa.amount_sek END) AS roa_pct
FROM financial_accounts fa
GROUP BY fa.orgnr, fa.year, fa.period;


