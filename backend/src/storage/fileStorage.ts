import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createError } from '../middleware/errorHandler';

const MEDIA_BUCKET = process.env.S3_BUCKET_MEDIA || 'kinetiq-media';
const AVATARS_BUCKET = process.env.S3_BUCKET_AVATARS || 'kinetiq-avatars';
const DOCS_BUCKET = process.env.S3_BUCKET_DOCS || 'kinetiq-docs';
const S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:19000';

export type UploadType = 'avatar' | 'video' | 'thumbnail' | 'document';

const getBucketAndKey = (type: UploadType, originalName: string) => {
  const ext = path.extname(originalName).toLowerCase();
  const fileId = uuidv4();

  switch (type) {
    case 'avatar':
      return { bucket: AVATARS_BUCKET, key: `avatars/${fileId}${ext}` };
    case 'video':
      return { bucket: MEDIA_BUCKET, key: `videos/${fileId}${ext}` };
    case 'thumbnail':
      return { bucket: MEDIA_BUCKET, key: `thumbnails/${fileId}${ext}` };
    case 'document':
      return { bucket: DOCS_BUCKET, key: `documents/${fileId}${ext}` };
    default:
      return { bucket: MEDIA_BUCKET, key: `misc/${fileId}${ext}` };
  }
};

export const uploadFile = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  type: UploadType
): Promise<{ url: string; key: string; bucket: string }> => {
  const { bucket, key } = getBucketAndKey(type, originalName);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: { originalName },
  }));

  const url = `${S3_PUBLIC_ENDPOINT}/${bucket}/${key}`;
  return { url, key, bucket };
};

export const getPresignedUploadUrl = async (
  fileName: string,
  mimeType: string,
  type: UploadType,
  expiresIn = 3600
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> => {
  const { bucket, key } = getBucketAndKey(type, fileName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const fileUrl = `${S3_PUBLIC_ENDPOINT}/${bucket}/${key}`;

  return { uploadUrl, fileUrl, key };
};

export const deleteFile = async (bucket: string, key: string): Promise<void> => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

export const getSignedDownloadUrl = async (bucket: string, key: string, expiresIn = 3600): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
};
