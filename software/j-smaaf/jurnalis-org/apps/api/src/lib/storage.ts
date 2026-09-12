import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? ''

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

export type LogicalBucket = 'public' | 'private'

export function resolveBucket(bucket: LogicalBucket): string {
  return bucket === 'public'
    ? (process.env.R2_BUCKET_PUBLIC ?? 'jurnalis-org-public')
    : (process.env.R2_BUCKET_PRIVATE ?? 'jurnalis-org-private')
}

export function publicUrl(bucket: LogicalBucket, path: string): string {
  if (bucket === 'public') {
    const base = process.env.R2_PUBLIC_URL ?? ''
    return `${base}/${path}`
  }
  return `r2-private://${path}`
}

export async function createUploadUrl(bucket: LogicalBucket, path: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: resolveBucket(bucket),
    Key: path,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}

export async function createDownloadUrl(bucket: LogicalBucket, path: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: resolveBucket(bucket),
    Key: path,
  })
  return getSignedUrl(r2, command, { expiresIn: 3600 })
}

export async function deleteObject(bucket: LogicalBucket, path: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: resolveBucket(bucket), Key: path }))
}

export async function listObjects(bucket: LogicalBucket, prefix: string) {
  const result = await r2.send(new ListObjectsV2Command({
    Bucket: resolveBucket(bucket),
    Prefix: prefix,
    MaxKeys: 100,
  }))
  return (result.Contents ?? []).map((obj) => ({
    path: obj.Key ?? '',
    size: obj.Size ?? 0,
    lastModified: obj.LastModified?.toISOString() ?? null,
  }))
}
