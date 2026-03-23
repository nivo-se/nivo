export type ScreeningCampaignSummary = {
  id: string;
  name: string;
  profileId?: string | null;
  profileVersionId?: string | null;
  status: string;
  currentStage?: string | null;
  statsJson?: Record<string, unknown>;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ScreeningCampaignCandidate = {
  orgnr: string;
  name?: string | null;
  layer0Rank?: number | null;
  profileWeightedScore?: number | null;
  archetypeCode?: string | null;
  isSelected?: boolean;
  finalRank?: number | null;
};

export type CreateCampaignPayload = {
  name: string;
  profileId: string;
  profileVersionId?: string | null;
  params?: {
    layer0Limit?: number;
    layer1Limit?: number;
    layer2Limit?: number;
    finalShortlistSize?: number;
    policy?: Record<string, unknown>;
    scoreWeights?: { deterministic?: number; fit?: number };
  };
  filters?: Array<{ field: string; op: string; value: unknown; type: string }>;
  excludeFilters?: Array<{ field: string; op: string; value: unknown; type: string }>;
  q?: string | null;
  overrides?: Record<string, unknown>;
};
