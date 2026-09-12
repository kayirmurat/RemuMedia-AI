import fs from "node:fs";
import path from "node:path";
import type { Artifact, WorkflowState } from "../domain/types.js";
import type { ArtifactRepository, WorkflowRepository } from "./types.js";

export class JsonWorkflowRepository implements WorkflowRepository {
  private dir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, "workflows");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  async get(id: string): Promise<WorkflowState | undefined> {
    const file = this.filePath(id);
    if (!fs.existsSync(file)) return undefined;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as WorkflowState;
  }

  async save(state: WorkflowState): Promise<void> {
    fs.writeFileSync(this.filePath(state.id), JSON.stringify(state, null, 2), "utf-8");
  }

  async list(): Promise<WorkflowState[]> {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    return files.map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf-8")) as WorkflowState);
  }
}

export class JsonArtifactRepository implements ArtifactRepository {
  private dir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, "artifacts");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  async save(artifact: Artifact): Promise<void> {
    fs.writeFileSync(path.join(this.dir, `${artifact.id}.json`), JSON.stringify(artifact, null, 2), "utf-8");
  }

  async listByWorkflow(workflowId: string): Promise<Artifact[]> {
    if (!fs.existsSync(this.dir)) return [];
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const all = files.map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf-8")) as Artifact);
    return all.filter((a) => a.workflowId === workflowId);
  }
}
