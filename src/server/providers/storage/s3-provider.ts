import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PutObjectInput, StorageProvider } from "./types";

export type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

/** Adapter S3-compatible: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, RustFS. */
export class S3StorageProvider implements StorageProvider {
  readonly driver = "S3" as const;
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint || undefined,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  async put(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "private, max-age=31536000, immutable",
      }),
    );
  }

  async signedUrl(key: string, expiresInSeconds: number, opts?: { downloadName?: string }): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentDisposition: opts?.downloadName
        ? `attachment; filename="${opts.downloadName.replace(/"/g, "")}"`
        : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  async get(key: string): Promise<{ body: Buffer; contentType?: string } | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: res.ContentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
