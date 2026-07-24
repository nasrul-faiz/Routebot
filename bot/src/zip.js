import { Buffer } from 'node:buffer';
import JSZip from 'jszip';
import { gunzipSync, gzipSync } from 'node:zlib';

function normalizeBase64(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function normalizeArchiveEntryName(value) {
  const cleaned = String(value || '').trim().replace(/[\\/]+/g, '_');
  return cleaned || 'attachment.bin';
}

export function zipTextToBase64(text) {
  const input = String(text || '').trim();
  if (!input) {
    return '';
  }

  return gzipSync(Buffer.from(input, 'utf8')).toString('base64');
}

export function unzipTextFromBase64(payload) {
  const encoded = normalizeBase64(payload);
  if (!encoded) {
    return '';
  }

  const zipped = Buffer.from(encoded, 'base64');
  return gunzipSync(zipped).toString('utf8');
}

export function buildZipCommandReply(text) {
  const input = String(text || '').trim();
  if (!input) {
    return 'Sila isi teks untuk di-zip.\nContoh: .zip Halo dunia';
  }

  const encoded = zipTextToBase64(input);
  const zippedBytes = Buffer.from(encoded, 'base64').length;
  const originalBytes = Buffer.byteLength(input, 'utf8');

  return [
    'ZIP Result (gzip+base64)',
    `Original bytes: ${originalBytes}`,
    `Gzip bytes: ${zippedBytes}`,
    '',
    encoded,
  ].join('\n');
}

export function buildUnzipCommandReply(payload) {
  const encoded = normalizeBase64(payload);
  if (!encoded) {
    return 'Sila isi data gzip+base64 untuk di-unzip.\nContoh: .unzip H4sIAAAAA...';
  }

  try {
    const text = unzipTextFromBase64(encoded);
    if (!text) {
      return 'Hasil unzip kosong.';
    }

    return ['UNZIP Result', '', text].join('\n');
  } catch {
    return 'Data unzip tidak sah. Pastikan input ialah gzip+base64 yang dijana oleh command zip.';
  }
}

export async function buildZipArchiveBuffer(contentBuffer, entryName = 'attachment.bin') {
  if (!Buffer.isBuffer(contentBuffer) || contentBuffer.length === 0) {
    return null;
  }

  const zip = new JSZip();
  zip.file(normalizeArchiveEntryName(entryName), contentBuffer);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function buildZipMediaCommandReply(contentBuffer, entryName = 'attachment.bin', archiveName = 'attachment.zip') {
  const archiveBuffer = await buildZipArchiveBuffer(contentBuffer, entryName);
  if (!archiveBuffer) {
    return {
      type: 'zip-file',
      document: null,
      fileName: archiveName,
      mimetype: 'application/zip',
    };
  }

  return {
    type: 'zip-file',
    document: archiveBuffer,
    fileName: archiveName,
    mimetype: 'application/zip',
  };
}