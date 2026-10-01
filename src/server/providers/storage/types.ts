export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
};

export interface StorageProvider {
  readonly driver: "S3" | "LOCAL";
  put(input: PutObjectInput): Promise<void>;
  /** URL temporal firmada para leer un objeto privado. */
  signedUrl(key: string, expiresInSeconds: number, opts?: { downloadName?: string }): Promise<string>;
  /** Lectura directa (usada por el driver local y exportaciones). */
  get(key: string): Promise<{ body: Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
}
