import fs from "node:fs/promises";
import path from "node:path";

import type { StorageProvider } from "../../providers/storage.js";

export class LocalStorageProvider implements StorageProvider {
  constructor(private rootDir: string) {}

  resolvePath(key: string): string {
    return path.join(this.rootDir, key);
  }

  async saveFile(localPath: string, key: string): Promise<string> {
    const destPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(localPath, destPath);
    return destPath;
  }

  async writeText(key: string, content: string): Promise<string> {
    const destPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, content, "utf8");
    return destPath;
  }

  async readText(key: string): Promise<string> {
    return fs.readFile(this.resolvePath(key), "utf8");
  }

  async ensureLocalFile(storedPath: string): Promise<string> {
    // saveFile/writeText'in döndürdüğü yol zaten gerçek bir yerel dosya yolu.
    return storedPath;
  }
}
