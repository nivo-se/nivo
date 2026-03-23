/** Layer 1 screening profile (list / detail). */
export type ScreeningProfileSummary = {
  id: string;
  name: string;
  description?: string | null;
  scope: string;
  ownerUserId?: string;
  activeVersionId?: string | null;
  activeVersion?: number | null;
  activeConfig?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ScreeningContext = {
  userId: string;
};
