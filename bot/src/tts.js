import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';

const execFileAsync = promisify(execFile);

function escapeQuery(value) {
  return encodeURIComponent(String(value || '').trim());
}

export function buildGoogleTtsUrl(text, lang = 'ms') {
  const safeText = escapeQuery(text);
  const safeLang = escapeQuery(lang || 'ms');
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${safeLang}&q=${safeText}`;
}

export async function fetchTtsAudioBuffer(text, lang = 'ms') {
  const safeText = String(text || '').trim();
  if (!safeText) {
    return null;
  }

  const tempFile = path.join(tmpdir(), `routebot-tts-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);
  const pythonScript = `
import sys
from gtts import gTTS

text = sys.argv[1]
lang = sys.argv[2] if len(sys.argv) > 2 else 'ms'
out_path = sys.argv[3] if len(sys.argv) > 3 else '/tmp/out.mp3'

speech = gTTS(text=text, lang=lang, slow=False)
speech.save(out_path)
`;

  try {
    await execFileAsync('python3', ['-c', pythonScript, safeText, lang, tempFile]);
    if (!existsSync(tempFile)) {
      return null;
    }

    const buffer = readFileSync(tempFile);
    return buffer;
  } catch {
    return null;
  } finally {
    if (existsSync(tempFile)) {
      try {
        unlinkSync(tempFile);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export async function buildTtsCommandResult(text, options = {}) {
  const safeText = String(text || '').trim();
  if (!safeText) {
    return {
      type: 'tts',
      text: '',
      audioUrl: null,
      audioBuffer: null,
      lang: options.lang || 'ms',
    };
  }

  const lang = options.lang || 'ms';
  const audioUrl = buildGoogleTtsUrl(safeText, lang);
  const audioBuffer = await fetchTtsAudioBuffer(safeText, lang);

  return {
    type: 'tts',
    text: safeText,
    audioUrl,
    audioBuffer,
    lang,
  };
}
