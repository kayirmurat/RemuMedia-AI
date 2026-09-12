export interface StorageProvider {
  saveFile(localPath: string, key: string): Promise<string>;
  writeText(key: string, content: string): Promise<string>;
  readText(key: string): Promise<string>;
  resolvePath(key: string): string;
}
