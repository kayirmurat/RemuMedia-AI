import type { SupabaseClient } from "@supabase/supabase-js";
import type { Artifact, ArtifactType } from "../../domain/types.js";
import type { ArtifactRepository } from "../../repository/types.js";
import { withRetry } from "../../util/retry.js";

interface ArtifactRow {
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

function toArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    type: row.type as ArtifactType,
    parentArtifactId: row.parent_artifact_id ?? undefined,
    createdAt: row.created_at,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    status: row.status as Artifact["status"],
    cost: row.cost,
    metadata: row.metadata,
    path: row.path,
  };
}

function toRow(artifact: Artifact): ArtifactRow {
  return {
    id: artifact.id,
    workflow_id: artifact.workflowId,
    type: artifact.type,
    parent_artifact_id: artifact.parentArtifactId ?? null,
    created_at: artifact.createdAt,
    provider: artifact.provider ?? null,
    model: artifact.model ?? null,
    status: artifact.status,
    cost: artifact.cost,
    metadata: artifact.metadata,
    path: artifact.path,
  };
}

export class SupabaseArtifactRepository implements ArtifactRepository {
  constructor(
    private client: SupabaseClient,
    private table = "artifacts",
  ) {}

  async save(artifact: Artifact): Promise<void> {
    await withRetry(async () => {
      const { error } = await this.client.from(this.table).upsert(toRow(artifact));
      if (error) throw new Error(`Supabase artifact yazma hatası: ${error.message}`);
    });
  }

  async listByWorkflow(workflowId: string): Promise<Artifact[]> {
    return withRetry(async () => {
      const { data, error } = await this.client.from(this.table).select("*").eq("workflow_id", workflowId);
      if (error) throw new Error(`Supabase artifact listeleme hatası: ${error.message}`);
      return (data as ArtifactRow[]).map(toArtifact);
    });
  }
}
