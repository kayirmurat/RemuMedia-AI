// ffmpeg filtergraph mini-dilinde tek tırnakla sarılan bir değeri güvenli hale getirir
// (drawtext'in fontfile=/textfile= gibi yol parametreleri için).
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "'\\''").replace(/:/g, "\\:");
}
