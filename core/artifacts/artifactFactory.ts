import path from "node:path";
import type { Artifact, ArtifactType } from "../domain/types.js";
import { newId, nowIso } from "../domain/ids.js";
import type { StorageProvider } from "../providers/storage.js";

interface BaseParams {
  storage: StorageProvider;
  workflowId: string;
  type: ArtifactType;
  provider?: string;
  model?: string;
  costUsd: number;
  metadata?: Record<string, unknown>;
}

export async function createTextArtifact(
  params: BaseParams & { content: string; extension?: string },
): Promise<Artifact> {
  const id = newId();
  const key = `${params.workflowId}/${params.type}/${id}${params.extension ?? ".txt"}`;
  const storedPath = await params.storage.writeText(key, params.content);
  return buildArtifact(id, params, storedPath);
}

export async function createFileArtifact(
  params: BaseParams & { localFilePath: string },
): Promise<Artifact> {
  const id = newId();
  const ext = path.extname(params.localFilePath);
  const key = `${params.workflowId}/${params.type}/${id}${ext}`;
  const storedPath = await params.storage.saveFile(params.localFilePath, key);
  return buildArtifact(id, params, storedPath);
}

function buildArtifact(id: string, params: BaseParams, storedPath: string): Artifact {
  return {
    id,
    workflowId: params.workflowId,
    type: params.type,
    createdAt: nowIso(),
    provider: params.provider,
    model: params.model,
    status: "ready",
    cost: params.costUsd,
    metadata: params.metadata ?? {},
    path: storedPath,
  };
}
