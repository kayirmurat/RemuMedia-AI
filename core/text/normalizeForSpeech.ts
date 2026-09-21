// LLM'in senaryoya yazdığı "°C" gibi semboller OpenAI TTS tarafından güvenilir
// biçimde Türkçe okunmuyor (bazen atlanıyor, bazen yanlış telaffuz ediliyor).
// Bu fonksiyon SADECE seslendirmeye giden metne uygulanır — altyazı/ekran
// metninde sembol olduğu gibi kalır, kullanıcı okurken sorun yaşamaz.
export function normalizeForSpeech(text: string): string {
  return text
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\s*[cC]\b/g, "$1 derece")
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°\s*[fF]\b/g, "$1 derece Fahrenhayt")
    .replace(/(-?\d+(?:[.,]\d+)?)\s*°/g, "$1 derece")
    .replace(/°/g, " derece");
}
