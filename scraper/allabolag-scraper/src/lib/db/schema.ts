import { pgTable, varchar, text, integer, jsonb, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";

export const jobs = pgTable("scraper_staging_jobs", {
  id: varchar("id", { length: 36 }).primaryKey(), // uuid string
  jobType: varchar("job_type", { length: 32 }).notNull(), // 'segmentation' | 'enrich_company_id'
  filterHash: varchar("filter_hash", { length: 64 }).notNull(), // SHA256 of filters JSON
  params: jsonb("params").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("running"), // running|done|error
  lastPage: integer("last_page").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  totalCompanies: integer("total_companies").default(0),
  error: text("error"),
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"), // pending|in_progress|completed|failed
  migrationNotes: text("migration_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rawCompanies = pgTable("scraper_staging_companies", {
  orgnr: varchar("orgnr", { length: 16 }).primaryKey(),
  companyName: text("company_name").notNull(),
  companyId: varchar("company_id", { length: 32 }), // canonical opaque id once known
  companyIdHint: varchar("company_id_hint", { length: 32 }), // whatever came in segmentation
  homepage: text("homepage"),
  naceCategories: jsonb("nace_categories").$type<string[]>().default([]),
  segmentName: jsonb("segment_name").$type<string[]>().default([]),
  revenueSek: integer("revenue_sek"),
  profitSek: integer("profit_sek"),
  foundationYear: integer("foundation_year"),
  accountsLastYear: varchar("company_accounts_last_year", { length: 8 }),
  scrapedAt: timestamp("scraped_at").defaultNow(),
  jobId: varchar("job_id", { length: 36 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending|reviewed|approved|rejected|migrated
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companyIds = pgTable("scraper_staging_company_ids", {
  orgnr: varchar("orgnr", { length: 16 }).primaryKey(),
  companyId: varchar("company_id", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull().default("scraper"),
  confidenceScore: varchar("confidence_score", { length: 5 }).default("1.0"),
  scrapedAt: timestamp("scraped_at").defaultNow(),
  jobId: varchar("job_id", { length: 36 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending|reviewed|approved|rejected|migrated
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Note: Index on raw_companies.companyId will be created via migration
// This is handled by Drizzle's index creation in the migration file
