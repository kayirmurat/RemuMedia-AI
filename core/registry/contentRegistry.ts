import type { WorkflowState } from "../domain/types.js";
import type { WorkflowRepository } from "../repository/types.js";

function normalize(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

export class ContentRegistry {
  constructor(private repo: WorkflowRepository) {}

  async findByTopic(topic: string): Promise<WorkflowState | undefined> {
    const target = normalize(topic);
    const all = await this.repo.list();
    return all.find((w) => normalize(w.topic) === target);
  }

  async list(): Promise<{ id: string; topic: string; completedSteps: number; totalSteps: number }[]> {
    const all = await this.repo.list();
    return all.map((w) => ({
      id: w.id,
      topic: w.topic,
      completedSteps: Object.values(w.steps).filter((s) => s.status === "completed").length,
      totalSteps: Object.keys(w.steps).length,
    }));
  }
}
