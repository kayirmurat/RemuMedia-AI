import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { CostLimitExceededError, WorkflowEngine, totalCost } from "../core/workflow/engine.js";
import { JsonArtifactRepository, JsonWorkflowRepository } from "../core/repository/jsonRepository.js";
import type { ArtifactRepository, WorkflowRepository } from "../core/repository/types.js";
import { LocalStorageProvider } from "../core/adapters/storage/localStorageProvider.js";
import type { StorageProvider } from "../core/providers/storage.js";
import { createSupabaseClient } from "../core/adapters/supabase/supabaseClient.js";
import { ensureBucket } from "../core/adapters/supabase/ensureBucket.js";
import { SupabaseWorkflowRepository } from "../core/adapters/supabase/supabaseWorkflowRepository.js";
import { SupabaseArtifactRepository } from "../core/adapters/supabase/supabaseArtifactRepository.js";
import { SupabaseStorageProvider } from "../core/adapters/supabase/supabaseStorageProvider.js";
import { OpenAILLMProvider } from "../core/adapters/openai/openaiLLMProvider.js";
import { OpenAIImageProvider } from "../core/adapters/openai/openaiImageProvider.js";
import { OpenAIVoiceProvider } from "../core/adapters/openai/openaiVoiceProvider.js";
import { FfmpegRenderer } from "../core/adapters/ffmpeg/ffmpegRenderer.js";
import { ContentRegistry } from "../core/registry/contentRegistry.js";
import { createLogger } from "../core/logger/logger.js";
import { createResearchStep } from "../core/workflow/steps/research.js";
import { createBriefStep } from "../core/workflow/steps/brief.js";
import { createScriptStep } from "../core/workflow/steps/script.js";
import { createVisualPlanStep } from "../core/workflow/steps/visualPlan.js";
import { createVisualAssetsStep } from "../core/workflow/steps/visualAssets.js";
import { createVoiceStep } from "../core/workflow/steps/voice.js";
import { createSubtitlesStep } from "../core/workflow/steps/subtitles.js";
import { createAssemblyStep } from "../core/workflow/steps/assembly.js";
import { createQcStep } from "../core/workflow/steps/qc.js";

const DEFAULT_MAX_COST_USD = 2.0;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const maxCostArg = get("--max-cost") ?? process.env.MAX_COST_PER_VIDEO;
  const maxCostUsd = maxCostArg !== undefined ? Number(maxCostArg) : DEFAULT_MAX_COST_USD;
  return { topic: get("--topic"), workflowId: get("--id"), maxCostUsd };
}

async function main() {
  const { topic, workflowId: existingId, maxCostUsd } = parseArgs();
  if (!topic && !existingId) {
    console.error('Kullanım: npm run produce -- --topic "konu" [--max-cost 2.5]');
    console.error('          npm run produce -- --id <workflow-id>   (kaldığı yerden devam)');
    process.exit(1);
  }
  if (Number.isNaN(maxCostUsd) || maxCostUsd <= 0) {
    console.error(`Geçersiz maliyet limiti: "${maxCostUsd}". Pozitif bir sayı olmalı.`);
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY tanımlı değil. .env dosyanı kontrol et (bkz. .env.example).");
    process.exit(1);
  }

  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  const storageDir = path.join(rootDir, "storage");
  const tempDir = path.join(storageDir, "tmp");
  const fontFile = path.join(rootDir, "assets", "fonts", "LiberationSans-Bold.ttf");

  const logger = createLogger();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseBucket = process.env.SUPABASE_BUCKET ?? "remumedia";

  let workflowRepo: WorkflowRepository;
  let artifactRepo: ArtifactRepository;
  let storage: StorageProvider;

  if (supabaseUrl && supabaseSecretKey) {
    const client = createSupabaseClient(supabaseUrl, supabaseSecretKey);
    await ensureBucket(client, supabaseBucket);
    workflowRepo = new SupabaseWorkflowRepository(client);
    artifactRepo = new SupabaseArtifactRepository(client);
    storage = new SupabaseStorageProvider(client, supabaseBucket);
    logger.info("Depolama: Supabase kullanılıyor", { bucket: supabaseBucket });
  } else {
    workflowRepo = new JsonWorkflowRepository(dataDir);
    artifactRepo = new JsonArtifactRepository(dataDir);
    storage = new LocalStorageProvider(storageDir);
    logger.info("Depolama: yerel dosya sistemi kullanılıyor (SUPABASE_URL/SUPABASE_SECRET_KEY yok)");
  }

  const registry = new ContentRegistry(workflowRepo);

  const workflowId = existingId ?? randomUUID();

  const existingState = await workflowRepo.get(workflowId);
  const resolvedTopic = existingState?.topic ?? topic;
  if (!resolvedTopic) {
    console.error(`Workflow "${workflowId}" bulunamadı ve --topic verilmedi.`);
    process.exit(1);
  }

  if (!existingState && topic) {
    const duplicate = await registry.findByTopic(topic);
    if (duplicate) {
      logger.warn("Bu konu daha önce işlenmiş, yine de yeni bir üretim başlatılıyor", {
        topic,
        existingWorkflowId: duplicate.id,
      });
    }
  }

  const llm = new OpenAILLMProvider(apiKey);
  const image = new OpenAIImageProvider(apiKey, tempDir);
  const voice = new OpenAIVoiceProvider(apiKey, tempDir);
  const renderer = new FfmpegRenderer(fontFile, tempDir);

  const engine = new WorkflowEngine(workflowRepo, artifactRepo, logger);

  const steps = [
    createResearchStep(llm, storage),
    createBriefStep(llm, storage),
    createScriptStep(llm, storage),
    createVisualPlanStep(llm, storage),
    createVisualAssetsStep(image, storage),
    createVoiceStep(voice, storage),
    createSubtitlesStep(storage),
    createAssemblyStep(renderer, storage, storageDir),
    createQcStep(renderer, storage),
  ];

  logger.info("Video üretim workflow'u başlıyor", { workflowId, topic: resolvedTopic, maxCostUsd });

  const finalState = await engine.run(workflowId, resolvedTopic, steps, { maxCostUsd });

  console.log("\n--- ÖZET ---");
  console.log(`Workflow ID: ${finalState.id}`);
  console.log(`Konu: ${finalState.topic}`);
  console.log(`Toplam tahmini maliyet: $${totalCost(finalState).toFixed(4)}`);
  console.log(`Final video: ${finalState.context.finalVideoPath}`);
}

main().catch((error) => {
  if (error instanceof CostLimitExceededError) {
    console.error(`\n${error.message}`);
    console.error(
      "Tamamlanan adımlar korundu. Devam etmek istiyorsan --max-cost ile daha yüksek bir limit " +
        've "--id <workflow-id>" ile tekrar çalıştır.',
    );
    process.exit(1);
  }
  console.error("\nWorkflow başarısız oldu:", error instanceof Error ? error.message : error);
  console.error('Aynı komutu "--id <workflow-id>" ile tekrar çalıştırarak kaldığı yerden devam edebilirsin.');
  process.exit(1);
});
