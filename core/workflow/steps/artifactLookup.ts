import type { Artifact, ArtifactType } from "../../domain/types.js";

// Aynı tipten (ör. bir "Yeniden Yaz" sonrası) birden fazla artifact varsa en
// son oluşturulanı seçer — sahne numarasına göre (image/voice) ya da tek bir
// en son artifact olarak (subtitles). assembly.ts ve coverImage.ts arasında
// paylaşılır.
export function latestBySceneNumber(artifacts: Artifact[], type: ArtifactType): Map<number, Artifact> {
  const map = new Map<number, Artifact>();
  for (const artifact of artifacts) {
    if (artifact.type !== type) continue;
    const sceneNumber = artifact.metadata.sceneNumber as number | undefined;
    if (sceneNumber === undefined) continue;
    const existing = map.get(sceneNumber);
    if (!existing || artifact.createdAt > existing.createdAt) map.set(sceneNumber, artifact);
  }
  return map;
}

export function latestOfType(artifacts: Artifact[], type: ArtifactType): Artifact | undefined {
  return artifacts
    .filter((a) => a.type === type)
    .reduce<Artifact | undefined>((latest, a) => (!latest || a.createdAt > latest.createdAt ? a : latest), undefined);
}
