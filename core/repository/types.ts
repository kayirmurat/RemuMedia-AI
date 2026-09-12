import type { Artifact, WorkflowState } from "../domain/types.js";

export interface WorkflowRepository {
  get(id: string): Promise<WorkflowState | undefined>;
  save(state: WorkflowState): Promise<void>;
  list(): Promise<WorkflowState[]>;
}

export interface ArtifactRepository {
  save(artifact: Artifact): Promise<void>;
  listByWorkflow(workflowId: string): Promise<Artifact[]>;
}
