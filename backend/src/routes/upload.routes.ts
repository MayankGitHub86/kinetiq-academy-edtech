import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireInstructor } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { uploadFile, getPresignedUploadUrl } from '../storage/fileStorage';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

// POST /api/v1/upload/avatar
router.post(
  '/avatar',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) { sendError(res, 'No file provided', 400); return; }
    const { url } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatar');
    sendCreated(res, { url }, 'Avatar uploaded');
  }
);

// POST /api/v1/upload/thumbnail
router.post(
  '/thumbnail',
  authenticate,
  requireInstructor,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) { sendError(res, 'No file provided', 400); return; }
    const { url, key } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'thumbnail');
    sendCreated(res, { url, key }, 'Thumbnail uploaded');
  }
);

// POST /api/v1/upload/presign - Get pre-signed URL for direct client upload
router.post(
  '/presign',
  authenticate,
  requireInstructor,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { fileName, mimeType, type } = req.body;
    if (!fileName || !mimeType || !type) { sendError(res, 'fileName, mimeType, and type are required', 400); return; }
    const result = await getPresignedUploadUrl(fileName, mimeType, type);
    sendSuccess(res, result, 'Presigned URL generated');
  }
);

export default router;
