CREATE TABLE "company_ids" (
	"orgnr" varchar(16) PRIMARY KEY NOT NULL,
	"company_id" varchar(32) NOT NULL,
	"source" varchar(32) DEFAULT 'search_json' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_type" varchar(32) NOT NULL,
	"filter_hash" varchar(64) NOT NULL,
	"params" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"last_page" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_companies" (
	"orgnr" varchar(16) PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_id" varchar(32),
	"company_id_hint" varchar(32),
	"homepage" text,
	"nace_categories" jsonb DEFAULT '[]'::jsonb,
	"segment_name" jsonb DEFAULT '[]'::jsonb,
	"revenue_sek" integer,
	"profit_sek" integer,
	"foundation_year" integer,
	"company_accounts_last_year" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_companies_company_id_idx" (
	"company_id" varchar(32),
	CONSTRAINT "raw_companies_company_id_idx_company_id_pk" PRIMARY KEY("company_id")
);
