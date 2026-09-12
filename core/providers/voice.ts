export interface VoiceResult {
  filePath: string;
  durationSeconds: number;
  provider: string;
  model: string;
  costUsd: number;
}

export interface VoiceProvider {
  synthesize(text: string, voice?: string): Promise<VoiceResult>;
}
