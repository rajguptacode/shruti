/** A small, careful wrapper around the browser's free speech synthesis. */

const PREFERRED_LOCALES = {
  hi: ['hi-in', 'hi', 'en-in', 'en-gb', 'en-us', 'en'],
  hinglish: ['en-in', 'hi-in', 'en-gb', 'en-us', 'en'],
  en: ['en-in', 'en-gb', 'en-us', 'en']
};

export function getSynthesis() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

export function isSupported() {
  return Boolean(getSynthesis() && typeof window.SpeechSynthesisUtterance === 'function');
}

function normalizeLang(lang) {
  return String(lang || '').toLowerCase().replace(/_/g, '-');
}

export function dedupeVoices(voices) {
  const seen = new Set();
  const result = [];
  for (const voice of voices || []) {
    const key = voice.voiceURI || `${voice.name}|${voice.lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(voice);
  }
  return result;
}

export function sortVoicesForUI(voices) {
  return [...dedupeVoices(voices)].sort((a, b) => {
    const rank = (voice) => {
      const lang = normalizeLang(voice.lang);
      if (lang === 'hi-in') return 0;
      if (lang.startsWith('hi')) return 1;
      if (lang === 'en-in') return 2;
      if (lang.startsWith('en')) return 3;
      return 4;
    };
    const diff = rank(a) - rank(b);
    if (diff) return diff;
    return a.name.localeCompare(b.name);
  });
}

export function findVoice(voices, voiceURI) {
  if (!voiceURI) return null;
  return (voices || []).find((voice) => voice.voiceURI === voiceURI) || null;
}

function scoreVoice(voice, preferenceIndex) {
  let score = 1000 - preferenceIndex * 100;
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (/natural|neural|premium|enhanced/.test(name)) score += 14;
  if (/google/.test(name)) score += 9;
  if (voice.localService) score += 2;
  if (voice.default) score += 1;
  return score;
}

export function chooseAutoVoice(voices, lang = 'en') {
  const list = dedupeVoices(voices);
  if (!list.length) return null;
  const preferences = PREFERRED_LOCALES[lang] || PREFERRED_LOCALES.en;
  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < preferences.length; i += 1) {
    const preference = preferences[i];
    for (const voice of list) {
      const locale = normalizeLang(voice.lang);
      const matches = locale === preference || locale.startsWith(`${preference}-`) || (preference.length === 2 && locale.startsWith(preference));
      if (!matches) continue;
      const score = scoreVoice(voice, i);
      if (score > bestScore) {
        best = voice;
        bestScore = score;
      }
    }
  }
  return best || list[0];
}

export function voicesMatchingLang(voices, lang) {
  const codes = { hi: ['hi'], hinglish: ['en', 'hi'], en: ['en'] }[lang] || ['en'];
  return dedupeVoices(voices).filter((voice) => codes.some((code) => normalizeLang(voice.lang).startsWith(code)));
}

export function voiceMatchesLang(voice, lang) {
  if (!voice) return false;
  const locale = normalizeLang(voice.lang);
  if (lang === 'hi') return locale.startsWith('hi');
  return locale.startsWith('en');
}

export function loadVoices(synth = getSynthesis(), timeout = 1400) {
  return new Promise((resolve) => {
    if (!synth) { resolve([]); return; }
    const existing = dedupeVoices(synth.getVoices());
    if (existing.length) { resolve(existing); return; }

    let settled = false;
    let timer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { synth.removeEventListener('voiceschanged', onChanged); } catch (error) {}
      resolve(dedupeVoices(synth.getVoices()));
    };
    const onChanged = () => {
      if (dedupeVoices(synth.getVoices()).length) finish();
    };
    try { synth.addEventListener('voiceschanged', onChanged); } catch (error) {}
    timer = setTimeout(finish, timeout);
  });
}

export function watchVoices(callback, synth = getSynthesis()) {
  if (!synth) return () => {};
  let last = '';
  const check = () => {
    const voices = dedupeVoices(synth.getVoices());
    const signature = voices.map((voice) => voice.voiceURI).join('|');
    if (signature !== last) {
      last = signature;
      callback(voices);
    }
  };
  check();
  try { synth.addEventListener('voiceschanged', check); } catch (error) {}
  return () => { try { synth.removeEventListener('voiceschanged', check); } catch (error) {} };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function speechErrorMessage(code) {
  switch (code) {
    case 'synthesis-failed':
    case 'synthesis-unavailable':
    case 'language-unavailable':
    case 'voice-unavailable':
      return 'No usable voice was found. Install an English or Hindi voice in your device’s text-to-speech settings, then reload. Settings → Voice has steps.';
    case 'network':
      return 'This voice needs an internet connection. Choose a device voice in Settings → Voice.';
    case 'audio-busy':
      return 'Another app is using the speaker. Close it and try again.';
    case 'audio-hardware':
      return 'No speaker was found. Check your device audio output.';
    default:
      return `Could not play this voice${code ? ` (${code})` : ''}. Try another voice in Settings → Voice.`;
  }
}

export class SpeechPlayer {
  constructor() {
    this.synth = getSynthesis();
    this.supported = isSupported();
    this.sentences = [];
    this.index = 0;
    this.playing = false;
    this.paused = false;
    this.finished = false;
    this.rate = 1;
    this.lang = 'en-IN';
    this.voice = null;
    this.loop = false;
    this.gapTimer = null;
    this.token = 0;
    this.current = null;
    this.needsRestart = false;
    this.listeners = new Map();
    if (this.synth) {
      try { this.synth.cancel(); } catch (error) {}
    }
  }

  on(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  emit(type, detail) {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    for (const handler of [...handlers]) handler(detail);
  }

  snapshot() {
    return {
      index: this.index,
      total: this.sentences.length,
      playing: this.playing,
      paused: this.paused,
      finished: this.finished,
      rate: this.rate,
      loop: this.loop,
      sentence: this.sentences[this.index]?.text || ''
    };
  }

  get total() { return this.sentences.length; }

  load(sentences, startIndex = 0) {
    this.clearGap();
    this.cancelSpeech();
    this.sentences = Array.isArray(sentences)
      ? sentences.map((item) => (typeof item === 'string' ? { text: item } : item)).filter((item) => item && item.text)
      : [];
    const max = Math.max(0, this.sentences.length - 1);
    this.index = clamp(Number.isFinite(startIndex) ? Math.floor(startIndex) : 0, 0, max);
    this.playing = false;
    this.paused = false;
    this.finished = false;
    this.needsRestart = false;
    this.emit('sentence', this.snapshot());
    this.emit('state', this.snapshot());
  }

  setRate(rate) {
    this.rate = clamp(Number(rate) || 1, 0.5, 2);
  }

  setVoice(voice) {
    this.voice = voice || null;
    if (voice && voice.lang) this.lang = voice.lang;
  }

  setLang(lang) {
    this.lang = lang || 'en-IN';
  }

  setLoop(value) {
    this.loop = Boolean(value);
    this.emit('state', this.snapshot());
  }

  clearGap() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  cancelSpeech() {
    this.token += 1;
    this.current = null;
    if (this.synth) {
      try { this.synth.cancel(); } catch (error) {}
    }
  }

  play() {
    if (!this.supported) {
      this.emit('error', { message: 'This browser does not support speech. Try Chrome, Edge, Safari or Firefox.' });
      return;
    }
    if (!this.total) return;
    if (this.finished) {
      this.index = 0;
      this.finished = false;
    }
    if (this.playing && this.paused) { this.resume(); return; }
    if (this.playing) return;
    this.playing = true;
    this.paused = false;
    this.needsRestart = false;
    this.emit('state', this.snapshot());
    this.speakCurrent();
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.clearGap();
    try { this.synth.pause(); } catch (error) {}
    this.paused = true;
    this.needsRestart = !this.synth.paused;
    this.emit('state', this.snapshot());
  }

  resume() {
    if (!this.playing) { this.play(); return; }
    if (!this.paused) return;
    this.paused = false;
    this.needsRestart = this.needsRestart || !this.synth.paused || !this.current;
    if (!this.needsRestart && this.synth.paused) {
      try { this.synth.resume(); } catch (error) { this.speakCurrent(); }
    } else {
      this.speakCurrent();
    }
    this.emit('state', this.snapshot());
  }

  toggle() {
    if (this.playing && !this.paused) this.pause();
    else this.play();
  }

  seek(index) {
    if (!this.total) return;
    const target = clamp(Math.floor(Number(index) || 0), 0, this.total - 1);
    const wasActive = this.playing && !this.paused;
    const wasPaused = this.playing && this.paused;
    this.cancelSpeech();
    this.clearGap();
    this.index = target;
    this.finished = false;

    if (wasActive) {
      this.playing = true;
      this.paused = false;
      this.needsRestart = false;
      this.emit('sentence', this.snapshot());
      this.emit('state', this.snapshot());
      this.speakCurrent();
      return;
    }
    if (wasPaused) {
      this.playing = true;
      this.paused = true;
      this.needsRestart = true;
    } else {
      this.playing = false;
      this.paused = false;
      this.needsRestart = false;
    }
    this.emit('sentence', this.snapshot());
    this.emit('state', this.snapshot());
  }

  next() {
    if (!this.total) return;
    if (this.index >= this.total - 1) {
      if (this.playing && !this.paused) this.finish();
      return;
    }
    this.seek(this.index + 1);
  }

  prev() {
    if (!this.total) return;
    if (this.index <= 0) {
      this.restartCurrent();
      return;
    }
    this.seek(this.index - 1);
  }

  restartCurrent() {
    if (!this.total) return;
    if (this.playing && !this.paused) {
      this.emit('state', this.snapshot());
      this.speakCurrent();
    } else if (this.playing && this.paused) {
      this.needsRestart = true;
      this.emit('state', this.snapshot());
    }
  }

  speakCurrent(gap = 0) {
    this.clearGap();
    this.token += 1;
    const token = this.token;
    this.current = null;
    if (this.synth) {
      try { this.synth.cancel(); } catch (error) {}
    }
    if (gap > 0) {
      this.gapTimer = setTimeout(() => {
        if (token !== this.token || !this.playing || this.paused) return;
        this.speakNow(token);
      }, gap);
    } else {
      this.speakNow(token);
    }
  }

  speakNow(token) {
    if (token !== this.token || !this.playing || this.paused) return;
    const item = this.sentences[this.index];
    if (!item) { this.finish(); return; }

    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = this.voice?.lang || this.lang;
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = this.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (token !== this.token) return;
      this.emit('start', this.snapshot());
    };
    utterance.onend = () => {
      if (token !== this.token) return;
      this.current = null;
      this.handleSentenceEnd();
    };
    utterance.onerror = (event) => {
      if (token !== this.token) return;
      const code = event?.error || '';
      if (code === 'canceled' || code === 'interrupted' || code === 'not-allowed') {
        if (code === 'not-allowed') {
          this.playing = false;
          this.paused = false;
          this.emit('error', { message: 'The browser blocked audio. Tap play once, then it should work.' });
          this.emit('state', this.snapshot());
        }
        return;
      }
      this.playing = false;
      this.paused = false;
      this.emit('error', { message: speechErrorMessage(code) });
      this.emit('state', this.snapshot());
    };

    this.current = utterance;
    try {
      this.synth.speak(utterance);
    } catch (error) {
      this.current = null;
      this.playing = false;
      this.paused = false;
      this.emit('error', { message: 'Could not start speech. Try another voice.' });
      this.emit('state', this.snapshot());
    }
  }

  handleSentenceEnd() {
    if (!this.playing || this.paused) return;
    if (this.loop) {
      this.emit('sentence', this.snapshot());
      this.speakCurrent(420);
      return;
    }
    if (this.index >= this.total - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.emit('sentence', this.snapshot());
    this.speakCurrent(140);
  }

  finish() {
    this.clearGap();
    this.cancelSpeech();
    this.playing = false;
    this.paused = false;
    this.finished = true;
    this.needsRestart = false;
    this.emit('state', this.snapshot());
    this.emit('finish', this.snapshot());
  }

  stop() {
    this.clearGap();
    this.cancelSpeech();
    this.playing = false;
    this.paused = false;
    this.finished = false;
    this.needsRestart = false;
    this.emit('state', this.snapshot());
  }

  testVoice(text) {
    if (!this.supported) return false;
    if (this.playing) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.voice?.lang || this.lang;
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = this.rate;
    try { this.synth.cancel(); this.synth.speak(utterance); return true; } catch (error) { return false; }
  }
}
