import type { DiagnosisScores, DiagnosisType } from "./diagnosis";

export type DiagnosisProfileMode = "light" | "advanced" | "viewer";

export type VtypeProfileFields = {
  vtype_id?: number;
  vtype_code?: string;
  vtype_name?: string;
  vtype_scores?: Partial<DiagnosisScores>;
  vtype_mode?: DiagnosisProfileMode | string;
  vtype_result_id?: string;
  vtype_updated_at?: string;
};

export const creatorVtypeStorageKey = "vtuber-match-creator-vtype-profile";
export const viewerVtypeStorageKey = "vtuber-match-viewer-vtype-profile";

export function buildVtypeProfileFields(input: {
  type: Pick<DiagnosisType, "id" | "code" | "name">;
  scores?: Partial<DiagnosisScores>;
  mode: DiagnosisProfileMode;
  resultId?: string | null;
  updatedAt?: string;
}): VtypeProfileFields {
  return {
    vtype_id: input.type.id,
    vtype_code: input.type.code,
    vtype_name: input.type.name,
    vtype_scores: input.scores,
    vtype_mode: input.mode,
    vtype_result_id: input.resultId || "",
    vtype_updated_at: input.updatedAt || new Date().toISOString(),
  };
}
