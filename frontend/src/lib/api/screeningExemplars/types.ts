/** GET /api/screening/exemplar-mandate */
export type ExemplarMandateResponse = {
  path: string;
  version: string | null;
  meta: Record<string, unknown>;
  keys: string[];
  /** Present when include_body=true */
  body?: Record<string, unknown>;
};

/** GET /api/screening/exemplar-chunks */
export type ExemplarChunkRow = {
  chunk_id: string;
  slug: string;
  source_path: string;
  chunk_index: number;
  content_text: string;
  orgnr: string | null;
  analysis_run_id: string | null;
  manifest_version: string | null;
  indexed_at: string | null;
};

export type ExemplarChunksResponse = {
  orgnr: string;
  count: number;
  chunks: ExemplarChunkRow[];
};
