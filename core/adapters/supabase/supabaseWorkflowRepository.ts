import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowState } from "../../domain/types.js";
import type { WorkflowRepository } from "../../repository/types.js";

interface WorkflowRow {
  id: string;
  topic: string;
  created_at: string;
  updated_at: string;
  steps: WorkflowState["steps"];
  context: WorkflowState["context"];
}

function toState(row: WorkflowRow): WorkflowState {
  return {
    id: row.id,
    topic: row.topic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: row.steps,
    context: row.context,
  };
}

function toRow(state: WorkflowState): WorkflowRow {
  return {
    id: state.id,
    topic: state.topic,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    steps: state.steps,
    context: state.context,
  };
}

export class SupabaseWorkflowRepository implements WorkflowRepository {
  constructor(
    private client: SupabaseClient,
    private table = "workflows",
  ) {}

  async get(id: string): Promise<WorkflowState | undefined> {
    const { data, error } = await this.client.from(this.table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase workflow okuma hatası: ${error.message}`);
    return data ? toState(data as WorkflowRow) : undefined;
  }

  async save(state: WorkflowState): Promise<void> {
    const { error } = await this.client.from(this.table).upsert(toRow(state));
    if (error) throw new Error(`Supabase workflow yazma hatası: ${error.message}`);
  }

  async list(): Promise<WorkflowState[]> {
    const { data, error } = await this.client.from(this.table).select("*");
    if (error) throw new Error(`Supabase workflow listeleme hatası: ${error.message}`);
    return (data as WorkflowRow[]).map(toState);
  }
}
