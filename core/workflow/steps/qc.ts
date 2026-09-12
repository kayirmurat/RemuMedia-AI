import type { AspectRatio, Renderer } from "../../providers/renderer.js";
import { ASPECT_RATIO_RESOLUTIONS } from "../../providers/renderer.js";
import type { StorageProvider } from "../../providers/storage.js";
import type { StepDefinition } from "../engine.js";
import { createTextArtifact } from "../../artifacts/artifactFactory.js";

export function createQcStep(
  renderer: Renderer,
  storage: StorageProvider,
  aspectRatio: AspectRatio = "9:16",
): StepDefinition {
  return {
    name: "qc",
    async run({ workflowId, state }) {
      const finalVideoPath = state.context.finalVideoPath as string;
      const probe = await renderer.probe(finalVideoPath);
      const expected = ASPECT_RATIO_RESOLUTIONS[aspectRatio];

      const checks = [
        { name: "video_stream_var", pass: probe.hasVideo, detail: "Video akışı bulunmalı" },
        { name: "audio_stream_var", pass: probe.hasAudio, detail: "Ses akışı bulunmalı" },
        { name: "duration_positive", pass: probe.durationSeconds > 1, detail: `Süre: ${probe.durationSeconds.toFixed(1)}s` },
        {
          name: "resolution_matches",
          pass: probe.width === expected.width && probe.height === expected.height,
          detail: `Beklenen ${expected.width}x${expected.height}, gerçek ${probe.width}x${probe.height}`,
        },
      ];

      const passed = checks.every((c) => c.pass);
      const report = {
        workflowId,
        passed,
        checks,
        probe,
        checkedAt: new Date().toISOString(),
      };

      const artifact = await createTextArtifact({
        storage,
        workflowId,
        type: "qc_report",
        content: JSON.stringify(report, null, 2),
        extension: ".json",
        costUsd: 0,
        metadata: { passed },
      });

      if (!passed) {
        const failed = checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`);
        throw new Error(`Kalite kontrolü başarısız: ${failed.join(", ")}`);
      }

      return { artifacts: [artifact], contextPatch: { qcPassed: true }, costUsd: 0 };
    },
  };
}
