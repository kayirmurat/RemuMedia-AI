import { execFile } from "node:child_process";
import { promisify } from "node:util";
// @ts-expect-error - paket için tip tanımı yok
import ffprobeStatic from "ffprobe-static";
import type { MediaProbe } from "../../providers/renderer.js";

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  codec_type: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const audioStream = data.streams?.find((s) => s.codec_type === "audio");

  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
  };
}
