import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutObjectInput, StorageProvider } from "./types";

/**
 * SOLO DESARROLLO. Guarda archivos en ./.uploads. En Docker el filesystem es efímero:
 * en producción usar siempre STORAGE_DRIVER=s3.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly driver = "LOCAL" as const;
  constructor(private readonly root = path.join(process.cwd(), ".uploads")) {}

  private resolve(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\|$))+/, "");
    const full = path.join(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error("Ruta inválida");
    return full;
  }

  async put(input: PutObjectInput): Promise<void> {
    const file = this.resolve(input.key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, input.body);
    await writeFile(`${file}.meta.json`, JSON.stringify({ contentType: input.contentType }));
  }

  async signedUrl(key: string): Promise<string> {
    // El driver local se sirve a través de /api/media (que ya valida la firma propia de la app)
    return `/api/media/local?key=${encodeURIComponent(key)}`;
  }

  async get(key: string): Promise<{ body: Buffer; contentType?: string } | null> {
    try {
      const file = this.resolve(key);
      const body = await readFile(file);
      const meta = JSON.parse(await readFile(`${file}.meta.json`, "utf8").catch(() => "{}")) as {
        contentType?: string;
      };
      return { body, contentType: meta.contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const file = this.resolve(key);
    await rm(file, { force: true });
    await rm(`${file}.meta.json`, { force: true });
  }
}
