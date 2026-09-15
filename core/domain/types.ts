export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface StepRecord {
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  artifactIds: string[];
  cost: number;
  provider?: string;
  model?: string;
}

export interface WorkflowState {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  steps: Record<string, StepRecord>;
  context: Record<string, unknown>;
}

export type ArtifactType =
  | "research"
  | "brief"
  | "script"
  | "visual_plan"
  | "content_review"
  | "image"
  | "voice"
  | "subtitles"
  | "final_video"
  | "thumbnail"
  | "music_selection"
  | "qc_report";

export interface MusicTrack {
  id: string;
  filename: string;
  moods: string[];
  license: string;
  source?: string;
}

export interface Artifact {
  id: string;
  workflowId: string;
  type: ArtifactType;
  parentArtifactId?: string;
  createdAt: string;
  provider?: string;
  model?: string;
  status: "ready" | "failed";
  cost: number;
  metadata: Record<string, unknown>;
  path: string;
}

export interface Scene {
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
}
