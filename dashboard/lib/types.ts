export interface StepRecord {
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  artifactIds: string[];
  cost: number;
  provider?: string;
  model?: string;
}

export interface WorkflowRow {
  id: string;
  topic: string;
  created_at: string;
  updated_at: string;
  steps: Record<string, StepRecord>;
  context: Record<string, unknown>;
}

export interface ArtifactRow {
  id: string;
  workflow_id: string;
  type: string;
  parent_artifact_id: string | null;
  created_at: string;
  provider: string | null;
  model: string | null;
  status: string;
  cost: number;
  metadata: Record<string, unknown>;
  path: string;
}

export const STEP_ORDER = [
  "research",
  "brief",
  "script",
  "visualPlan",
  "contentReview",
  "musicSelection",
  "visualAssets",
  "voice",
  "subtitles",
  "assembly",
  "qc",
] as const;

export type WorkflowPhase = "review" | "running" | "completed" | "failed";

export function workflowPhase(steps: Record<string, StepRecord>): WorkflowPhase {
  if (Object.values(steps).some((s) => s.status === "failed")) return "failed";
  if (steps.qc?.status === "completed") return "completed";

  const reviewGate: (typeof STEP_ORDER)[number][] = ["research", "brief", "script", "visualPlan", "contentReview"];
  const gatePassed = reviewGate.every((name) => steps[name]?.status === "completed");
  const pastGateStarted = steps.visualAssets && steps.visualAssets.status !== "pending";
  if (gatePassed && !pastGateStarted) return "review";

  return "running";
}

export function totalCost(steps: Record<string, StepRecord>): number {
  return Object.values(steps).reduce((sum, s) => sum + (s.cost ?? 0), 0);
}

// storage.ts'in resolvePath'i döndürdüğü "supabase://bucket/key" biçiminden
// gerçek bucket key'ini çıkarır (signed URL/indirme için gerekir).
export function storageKeyFromPath(path: string): string | null {
  const match = path.match(/^supabase:\/\/[^/]+\/(.+)$/);
  return match ? match[1]! : null;
}
