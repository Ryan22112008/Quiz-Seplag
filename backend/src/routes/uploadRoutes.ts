import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router, type ErrorRequestHandler, type RequestHandler } from 'express';
import multer from 'multer';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const storageDirectory = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => { void mkdir(storageDirectory, { recursive: true }).then(() => callback(null, storageDirectory), (error: Error) => callback(error, storageDirectory)); },
    filename: (_request, _file, callback) => callback(null, `.upload-${randomUUID()}`),
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
});

export function createUploadRoutes(protectUpload?: RequestHandler): Router {
  const router = Router();
  router.post('/uploads', ...(protectUpload ? [protectUpload] : []), upload.single('image'), uploadImage);
  router.get('/uploads/:filename', serveImage);
  const uploadErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error instanceof multer.MulterError) {
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { message: error.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 5 MB.' : 'Envie somente um arquivo de imagem.' } });
      return;
    }
    if (error && typeof error === 'object' && 'code' in error && ['EACCES', 'EROFS', 'ENOSPC'].includes(String(error.code))) {
      response.status(503).json({ error: { message: 'O armazenamento de imagens está indisponível no servidor. Tente novamente mais tarde.' } });
      return;
    }
    next(error);
  };
  router.use(uploadErrorHandler);
  return router;
}

const uploadImage: RequestHandler = async (request, response, next) => {
  const file = request.file;
  if (!file) { response.status(400).json({ error: { message: 'Envie um arquivo de imagem.' } }); return; }
  try {
    const handle = await open(file.path, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    await handle.close();
    const extension = detectImageExtension(header.subarray(0, bytesRead));
    if (!extension) throw new Error('INVALID_IMAGE_CONTENT');
    const filename = `${randomUUID()}.${extension}`;
    await rename(file.path, join(storageDirectory, filename));
    response.status(201).json({ imageUrl: `/uploads/${filename}` });
  } catch (error) {
    await unlink(file.path).catch(() => undefined);
    if (error instanceof Error && error.message === 'INVALID_IMAGE_CONTENT') { response.status(400).json({ error: { message: 'O conteúdo do arquivo não corresponde a uma imagem válida.' } }); return; }
    next(error);
  }
};

const serveImage: RequestHandler = async (request, response, next) => {
  const filename = request.params.filename;
  if (typeof filename !== 'string' || !/^[a-f0-9-]{36}\.(?:png|jpg|webp)$/u.test(filename)) { response.sendStatus(404); return; }
  const mime = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  response.set({ 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' });
  try { await pipeline(createReadStream(join(storageDirectory, filename)), response); }
  catch (error) { if (!response.headersSent) response.sendStatus(404); else next(error); }
};

function detectImageExtension(header: Buffer): 'png' | 'jpg' | 'webp' | undefined {
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'jpg';
  if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}
