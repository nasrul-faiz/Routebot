import axios from 'axios';

function escapeQuery(value) {
  return encodeURIComponent(String(value || '').trim());
}

export function buildGoogleTtsUrl(text, lang = 'ms') {
  const safeText = escapeQuery(text);
  const safeLang = escapeQuery(lang || 'ms');
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${safeLang}&q=${safeText}`;
}

export async function fetchTtsAudioBuffer(text, lang = 'ms', options = {}) {
  const safeText = String(text || '').trim();
  if (!safeText) {
    return null;
  }

  try {
    const audioUrl = buildGoogleTtsUrl(safeText, lang);
    if (typeof options.fetchAudio === 'function') {
      return await options.fetchAudio(audioUrl, { text: safeText, lang });
    }

    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://translate.google.com/',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    return Buffer.from(response.data);
  } catch {
    return null;
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
  const audioBuffer = await fetchTtsAudioBuffer(safeText, lang, options);

  return {
    type: 'tts',
    text: safeText,
    audioUrl,
    audioBuffer,
    lang,
  };
}
