import axios from 'axios';

const MAX_TTS_TEXT_LENGTH = 200;

function escapeQuery(value) {
  return encodeURIComponent(String(value || '').trim());
}

function normalizeTtsText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TTS_TEXT_LENGTH);
}

export function buildGoogleTtsUrl(text, lang = 'ms') {
  const safeText = escapeQuery(normalizeTtsText(text));
  const safeLang = escapeQuery(lang || 'ms');
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${safeLang}&q=${safeText}`;
}

export function buildGoogleApisTtsUrl(text, lang = 'ms') {
  const safeText = escapeQuery(normalizeTtsText(text));
  const safeLang = escapeQuery(lang || 'ms');
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${safeLang}&q=${safeText}`;
}

async function requestAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://translate.google.com/',
      Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1',
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  return Buffer.from(response.data);
}

export async function fetchTtsAudioBuffer(text, lang = 'ms', options = {}) {
  const safeText = normalizeTtsText(text);
  if (!safeText) {
    return null;
  }

  try {
    const audioUrl = buildGoogleTtsUrl(safeText, lang);
    if (typeof options.fetchAudio === 'function') {
      return await options.fetchAudio(audioUrl, { text: safeText, lang });
    }

    return await requestAudioBuffer(audioUrl);
  } catch {
    try {
      const fallbackUrl = buildGoogleApisTtsUrl(safeText, lang);
      return await requestAudioBuffer(fallbackUrl);
    } catch {
      return null;
    }
  }
}

export async function buildTtsCommandResult(text, options = {}) {
  const safeText = normalizeTtsText(text);
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
  const audioBuffer = await fetchTtsAudioBuffer(safeText, lang, options);

  return {
    type: 'tts',
    text: safeText,
    audioUrl,
    audioBuffer,
    lang,
  };
}
