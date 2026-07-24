import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const STICKER_SIZE = 512;
const MAX_VIDEO_SECONDS = 7;

if (typeof ffmpegPath === 'string' && ffmpegPath.length > 0) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export function parseStickerCommandFlags(arg = '') {
  const normalized = String(arg || '').trim().toLowerCase();
  const removeBackground = /(^|\s)(nobg|no-bg|transparent|cutout)(\s|$)/i.test(normalized);

  return {
    removeBackground,
  };
}

function buildStickerError(text) {
  return {
    type: 'sticker',
    stickerBuffer: null,
    text,
  };
}

async function removeBackgroundFromImage(imageBuffer, apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new Error('Mode nobg perlukan REMOVE_BG_API_KEY dalam env.');
  }

  const form = new FormData();
  form.append('size', 'auto');
  form.append('format', 'png');
  form.append('image_file_b64', imageBuffer.toString('base64'));

  const response = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
    headers: {
      ...form.getHeaders(),
      'X-Api-Key': key,
    },
    responseType: 'arraybuffer',
    timeout: 60000,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  return Buffer.from(response.data);
}

async function convertImageToSticker(imageBuffer) {
  return sharp(imageBuffer)
    .rotate()
    .resize(STICKER_SIZE, STICKER_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer();
}

function convertVideoToSticker(videoInputPath, webpOutputPath) {
  const filter = [
    `scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease`,
    'fps=12',
    `pad=${STICKER_SIZE}:${STICKER_SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
  ].join(',');

  return new Promise((resolve, reject) => {
    ffmpeg(videoInputPath)
      .setStartTime(0)
      .duration(MAX_VIDEO_SECONDS)
      .outputOptions([
        '-vcodec libwebp',
        `-vf ${filter}`,
        '-loop 0',
        '-an',
        '-preset default',
        '-vsync 0',
      ])
      .save(webpOutputPath)
      .on('end', resolve)
      .on('error', reject);
  });
}

async function convertVideoBufferToSticker(videoBuffer) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'routebot-sticker-'));
  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'output.webp');

  try {
    await writeFile(inputPath, videoBuffer);
    await convertVideoToSticker(inputPath, outputPath);
    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function buildStickerCommandReply(mediaBuffer, options = {}) {
  const mediaType = String(options.mediaType || '').trim().toLowerCase();
  const removeBackground = Boolean(options.removeBackground);

  if (!Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
    return buildStickerError('Media kosong atau tidak sah untuk diproses.');
  }

  if (mediaType !== 'image' && mediaType !== 'video') {
    return buildStickerError('Media tidak disokong. Guna gambar atau video.');
  }

  if (removeBackground && mediaType !== 'image') {
    return buildStickerError('Mode nobg hanya untuk gambar.');
  }

  try {
    let stickerSource = mediaBuffer;
    if (removeBackground) {
      stickerSource = await removeBackgroundFromImage(mediaBuffer, options.removeBgApiKey);
    }

    const stickerBuffer = mediaType === 'video'
      ? await convertVideoBufferToSticker(stickerSource)
      : await convertImageToSticker(stickerSource);

    if (!Buffer.isBuffer(stickerBuffer) || stickerBuffer.length === 0) {
      return buildStickerError('Gagal membina sticker dari media yang diberi.');
    }

    return {
      type: 'sticker',
      stickerBuffer,
      text: removeBackground
        ? 'Sticker tanpa background siap dihantar.'
        : 'Sticker siap dihantar.',
    };
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'Ralat tidak diketahui semasa proses sticker.';

    return buildStickerError(`Gagal proses sticker: ${message}`);
  }
}
