import type { Artifact, WorkflowState } from "../domain/types.js";
import { nowIso } from "../domain/ids.js";
import type { ArtifactRepository, WorkflowRepository } from "../repository/types.js";
import type { Logger } from "../logger/logger.js";

export interface WorkflowContext {
  workflowId: string;
  state: WorkflowState;
}

export interface StepOutput {
  artifacts?: Artifact[];
  contextPatch?: Record<string, unknown>;
  costUsd: number;
  provider?: string;
  model?: string;
}

export interface StepDefinition {
  name: string;
  run(ctx: WorkflowContext): Promise<StepOutput>;
}

export class WorkflowStepError extends Error {
  constructor(
    public readonly step: string,
    message: string,
  ) {
    super(`Adım "${step}" başarısız oldu: ${message}`);
  }
}

export class CostLimitExceededError extends Error {
  constructor(
    public readonly costUsd: number,
    public readonly maxCostUsd: number,
    public readonly lastStep: string,
  ) {
    super(
      `Maliyet limiti aşıldı: $${costUsd.toFixed(4)} (limit: $${maxCostUsd.toFixed(4)}) — ` +
        `"${lastStep}" adımından sonra durduruldu.`,
    );
  }
}

export interface WorkflowRunOptions {
  maxCostUsd?: number;
  // Sadece workflow İLK kez oluşturulurken context'e eklenir (ör. kullanıcının
  // ton/format için verdiği bir prodüksiyon notu) — devam eden bir workflow'da
  // yok sayılır.
  initialContext?: Record<string, unknown>;
}

export class WorkflowEngine {
  constructor(
    private workflowRepo: WorkflowRepository,
    private artifactRepo: ArtifactRepository,
    private logger: Logger,
  ) {}

  async run(
    workflowId: string,
    topic: string,
    steps: StepDefinition[],
    options: WorkflowRunOptions = {},
  ): Promise<WorkflowState> {
    let state = await this.workflowRepo.get(workflowId);
    if (!state) {
      state = {
        id: workflowId,
        topic,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        steps: Object.fromEntries(
          steps.map((s) => [s.name, { status: "pending" as const, artifactIds: [], cost: 0 }]),
        ),
        context: { topic, ...options.initialContext },
      };
      await this.workflowRepo.save(state);
    }

    for (const step of steps) {
      const record = state.steps[step.name];
      if (!record) {
        state.steps[step.name] = { status: "pending", artifactIds: [], cost: 0 };
      }
      const current = state.steps[step.name]!;

      if (current.status === "completed") {
        this.logger.info(`Adım zaten tamamlanmış, atlanıyor`, { step: step.name, workflowId });
        continue;
      }

      this.logger.info(`Adım başlıyor`, { step: step.name, workflowId });
      current.status = "running";
      current.startedAt = nowIso();
      current.error = undefined;
      state.updatedAt = nowIso();
      await this.workflowRepo.save(state);

      try {
        const output = await step.run({ workflowId, state });

        for (const artifact of output.artifacts ?? []) {
          await this.artifactRepo.save(artifact);
          current.artifactIds.push(artifact.id);
        }

        current.status = "completed";
        current.finishedAt = nowIso();
        current.cost = output.costUsd;
        current.provider = output.provider;
        current.model = output.model;

        state.context = { ...state.context, ...(output.contextPatch ?? {}) };
        state.updatedAt = nowIso();
        await this.workflowRepo.save(state);

        this.logger.info(`Adım tamamlandı`, {
          step: step.name,
          workflowId,
          costUsd: Number(output.costUsd.toFixed(4)),
        });

        if (options.maxCostUsd !== undefined) {
          const spent = totalCost(state);
          if (spent > options.maxCostUsd) {
            this.logger.error(`Maliyet limiti aşıldı, workflow durduruluyor`, {
              workflowId,
              spentUsd: Number(spent.toFixed(4)),
              maxCostUsd: options.maxCostUsd,
            });
            throw new CostLimitExceededError(spent, options.maxCostUsd, step.name);
          }
        }
      } catch (error) {
        if (error instanceof CostLimitExceededError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        current.status = "failed";
        current.error = message;
        current.finishedAt = nowIso();
        state.updatedAt = nowIso();
        await this.workflowRepo.save(state);
        this.logger.error(`Adım başarısız`, { step: step.name, workflowId, error: message });
        throw new WorkflowStepError(step.name, message);
      }
    }

    return state;
  }
}

export function totalCost(state: WorkflowState): number {
  return Object.values(state.steps).reduce((sum, s) => sum + (s.cost ?? 0), 0);
}
