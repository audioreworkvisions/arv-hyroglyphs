import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import JSZip from 'jszip';
import {
  buildGifVideoFilter,
  normalizeGifAspectRatio,
  normalizeGifOutputSize,
} from '../utils/video';

const preparedDownloadDirectory = path.join(os.tmpdir(), 'hyroglyphis-downloads');
const preparedStoryZipDownloads = new Map<string, { filePath: string; fileName: string; cleanupTimer: NodeJS.Timeout }>();
const STORY_ZIP_TTL_MS = 5 * 60 * 1000;

const ensurePreparedDownloadDirectory = () => {
  fs.mkdirSync(preparedDownloadDirectory, { recursive: true });
};

const ensureLocalDownloadDirectory = () => {
  const downloadsDirectory = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadsDirectory, { recursive: true });
  return downloadsDirectory;
};

const createUniqueFilePath = (directoryPath: string, fileName: string) => {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let candidatePath = path.join(directoryPath, fileName);
  let index = 1;

  while (fs.existsSync(candidatePath)) {
    candidatePath = path.join(directoryPath, `${baseName}_${index}${extension}`);
    index += 1;
  }

  return candidatePath;
};

const deleteFileIfPresent = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best effort cleanup for temp download artifacts.
  }
};

const clearPreparedStoryZipDownload = (downloadId: string) => {
  const entry = preparedStoryZipDownloads.get(downloadId);
  if (!entry) {
    return;
  }

  clearTimeout(entry.cleanupTimer);
  preparedStoryZipDownloads.delete(downloadId);
  deleteFileIfPresent(entry.filePath);
};

const registerPreparedStoryZipDownload = (filePath: string, fileName: string) => {
  const downloadId = randomUUID();
  const cleanupTimer = setTimeout(() => {
    clearPreparedStoryZipDownload(downloadId);
  }, STORY_ZIP_TTL_MS);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  preparedStoryZipDownloads.set(downloadId, { filePath, fileName, cleanupTimer });
  return downloadId;
};

const sanitizeFileBaseName = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return normalized || fallback;
};

const decodeGifDataUrl = (gifData: unknown): Buffer => {
  if (typeof gifData !== 'string') {
    throw new Error('GIF data must be a string.');
  }

  const separatorIndex = gifData.indexOf(',');
  if (separatorIndex === -1) {
    throw new Error('GIF data is not a valid data URL.');
  }

  return Buffer.from(gifData.slice(separatorIndex + 1), 'base64');
};

export const createGifRoutes = () => {
  const router = Router();

  router.post('/api/story-zip', async (req, res) => {
    try {
      const storyName = sanitizeFileBaseName(req.body?.storyName, 'story');
      const rawScenes = Array.isArray(req.body?.scenes) ? req.body.scenes : [];
      const deliveryMode = req.body?.deliveryMode === 'save-local' ? 'save-local' : 'download';

      if (rawScenes.length === 0) {
        return res.status(400).json({ error: 'At least one scene is required.' });
      }

      const zip = new JSZip();
      let addedScenes = 0;

      rawScenes.forEach((scene: any, index: number) => {
        try {
          const fileBaseName = sanitizeFileBaseName(scene?.fileName, `${storyName}_scene_${index + 1}`);
          zip.file(`${fileBaseName}.gif`, decodeGifDataUrl(scene?.gifData));
          addedScenes += 1;
        } catch {
          // Skip malformed scene payloads and validate below.
        }
      });

      if (addedScenes === 0) {
        return res.status(400).json({ error: 'No valid GIF scenes were provided for ZIP export.' });
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      ensurePreparedDownloadDirectory();
      const preparedFileName = `${storyName}.zip`;

      if (deliveryMode === 'save-local') {
        const downloadsDirectory = ensureLocalDownloadDirectory();
        const outputPath = createUniqueFilePath(downloadsDirectory, preparedFileName);
        fs.writeFileSync(outputPath, zipBuffer);

        return res.json({
          success: true,
          savedPath: outputPath,
          fileName: path.basename(outputPath),
        });
      }

      const preparedFilePath = path.join(preparedDownloadDirectory, `${randomUUID()}.zip`);
      fs.writeFileSync(preparedFilePath, zipBuffer);
      const downloadId = registerPreparedStoryZipDownload(preparedFilePath, preparedFileName);

      return res.json({
        success: true,
        downloadUrl: `/api/story-zip/${downloadId}`,
        fileName: preparedFileName,
      });
    } catch (error: any) {
      console.error('Error preparing story ZIP:', error);
      return res.status(500).json({ error: error.message || 'Failed to prepare story ZIP.' });
    }
  });

  router.get('/api/story-zip/:downloadId', (req, res) => {
    const downloadId = req.params.downloadId;
    const preparedDownload = preparedStoryZipDownloads.get(downloadId);

    if (!preparedDownload) {
      return res.status(404).json({ error: 'Story ZIP download expired or was not found.' });
    }

    return res.download(preparedDownload.filePath, preparedDownload.fileName, (error) => {
      clearPreparedStoryZipDownload(downloadId);

      if (error && !res.headersSent) {
        res.status(500).json({ error: error.message || 'Failed to send story ZIP.' });
      }
    });
  });

  router.post('/api/convert-gif', async (req, res) => {
    try {
      const { videoBase64, videoUrl, aspectRatio, outputSize } = req.body;

      if (!videoBase64 && !videoUrl) {
        return res.status(400).json({ error: 'Video data or URL is required' });
      }

      const normalizedAspectRatio = normalizeGifAspectRatio(aspectRatio);
      const normalizedOutputSize = normalizeGifOutputSize(outputSize);
      const gifVideoFilter = buildGifVideoFilter(normalizedAspectRatio, normalizedOutputSize);

      console.log('Received video request. Converting to GIF...');

      const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}.mp4`);
      const tempGifPath = path.join(os.tmpdir(), `temp_${Date.now()}.gif`);

      if (videoBase64) {
        const videoBuffer = Buffer.from(videoBase64.split(',')[1], 'base64');
        fs.writeFileSync(tempVideoPath, videoBuffer);
      } else if (videoUrl) {
        console.log(`Downloading video from URL: ${videoUrl}`);
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`Failed to download video: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempVideoPath, buffer);
      }

      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .outputOptions([
            '-vf',
            gifVideoFilter,
            '-loop',
            '0',
          ])
          .toFormat('gif')
          .on('end', () => {
            console.log('GIF conversion finished.');
            resolve();
          })
          .on('error', (err) => {
            console.error('Error during GIF conversion:', err);
            reject(err);
          })
          .save(tempGifPath);
      });

      const gifBuffer = fs.readFileSync(tempGifPath);
      const gifBase64 = gifBuffer.toString('base64');

      fs.unlinkSync(tempVideoPath);
      fs.unlinkSync(tempGifPath);

      return res.json({
        success: true,
        outputSize: normalizedOutputSize,
        aspectRatio: normalizedAspectRatio || undefined,
        gifData: `data:image/gif;base64,${gifBase64}`,
      });
    } catch (error: any) {
      console.error('Error converting GIF:', error);
      return res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  return router;
};