import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const {
  S3_ENDPOINT = 'http://localhost:19000',
  S3_ACCESS_KEY = '',
  S3_SECRET_KEY = '',
  S3_REGION = 'us-east-1',
  S3_FORCE_PATH_STYLE = 'true',
} = process.env;

export const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: S3_FORCE_PATH_STYLE === 'true',
});

const BUCKETS = [
  process.env.S3_BUCKET_MEDIA || 'kinetiq-media',
  process.env.S3_BUCKET_AVATARS || 'kinetiq-avatars',
  process.env.S3_BUCKET_DOCS || 'kinetiq-docs',
];

export const initializeStorage = async (): Promise<void> => {
  for (const bucket of BUCKETS) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      logger.info(`✅ S3 bucket exists: ${bucket}`);
    } catch {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        logger.info(`✅ S3 bucket created: ${bucket}`);
      } catch (err) {
        logger.warn(`⚠️ Could not create bucket ${bucket}:`, err);
      }
    }
  }
};
