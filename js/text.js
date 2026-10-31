/**
 * Text preparation for Shruti.
 * Turns pasted notes into readable blocks and speakable sentences.
 */

const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc',
  'eg', 'ie', 'fig', 'no', 'ch', 'sec', 'rs', 'approx', 'al', 'vol', 'pp',
  'p', 'cf', 'ca', 'viz', 'resp'
]);

const HINGLISH_WORDS = new Set([
  'hai', 'hain', 'ka', 'ki', 'ke', 'ko', 'mein', 'aur', 'nahi', 'nahin',
  'kya', 'aap', 'hum', 'tum', 'yeh', 'ye', 'woh', 'wo', 'karna', 'karte',
  'karti', 'hota', 'hoti', 'hote', 'samajh', 'matlab', 'samjho', 'dekho',
  'chalo', 'bahut', 'thoda', 'accha', 'acha', 'theek', 'thik', 'kyun',
  'kyunki', 'isliye', 'wala', 'wali', 'raha', 'rahi', 'rahe', 'gaya',
  'gayi', 'diya', 'liya', 'padhai', 'bhai', 'dost', 'toh', 'phir',
  'jab', 'tab', 'sab', 'kuch', 'bhi', 'likhna', 'padhna', 'yaad'
]);

const EMOJI_RE = (() => {
  try { return new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D]', 'gu'); }
  catch (e) { return /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu; }
})();

const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const LATIN_RE = /[A-Za-z]/g;

export function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n');
}

/** Remove the markdown noise that comes with copied AI answers. */
export function cleanInline(value) {
  let text = String(value || '');
  text = text.replace(/<br\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/https?:\/\/\S+/gi, '');
  text = text.replace(/`{1,3}/g, '');
  text = text.replace(/(\*\*|__|~~)(.*?)\1/g, '$2');
  text = text.replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,!?:;]|$)/g, '$1$2');
  text = text.replace(/^[\s>#]+/, '');
  text = text.replace(EMOJI_RE, '');
  text = text.replace(/[•●▪◦]/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

function isSeparator(line) {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function headingMatch(line) {
  return line.match(/^\s*#{1,6}\s+(.+?)\s*$/);
}

function bulletMatch(line) {
  return line.match(/^\s*(?:[-*+]\s+|(\d{1,3})[.)]\s+)(.+)$/);
}

function tableCells(line) {
  if (!/^\s*\|.*\|\s*$/.test(line)) return null;
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cleanInline(cell));
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return { separator: true, cells: [] };
  return { separator: false, cells: cells.filter(Boolean) };
}

function splitLongSentence(text, maxLen = 240) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let rest = text.trim();
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen);
    let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' — '));
    if (cut < maxLen * 0.45) cut = window.lastIndexOf(' ');
    if (cut < maxLen * 0.35) cut = maxLen - 1;
    const piece = rest.slice(0, cut + 1).trim();
    if (piece) parts.push(piece);
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function isAbbreviationFragment(segment) {
  const bare = segment.replace(/[)"'\]]+$/, '').trim();
  if (new RegExp(`^(?:${[...ABBREVIATIONS].join('|')})\\.$`, 'i').test(bare)) return true;
  if (/^(?:[A-Z]\.){1,3}$/.test(bare)) return true;
  if (/\s[A-Z]\.$/.test(bare)) return true;
  return false;
}

function shouldMerge(previous, next) {
  if (!previous || !next) return false;
  if (isAbbreviationFragment(previous)) return true;
  if (previous.length < 3) return true;
  if (/^[a-z]/.test(next) && /^(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|Fig|No|Ch|Sec|Rs|approx|al|Vol|pp|cf)\.$/i.test(previous)) return true;
  return false;
}

/** Split a block of text into sentences, including Devanagari danda. */
export function splitSentences(value) {
  const text = cleanInline(value);
  if (!text) return [];

  let raw;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    raw = [...segmenter.segment(text)].map((part) => part.segment.trim()).filter(Boolean);
  } else {
    raw = text.split(/(?<=[.!?।॥])\s+/u).map((part) => part.trim()).filter(Boolean);
  }

  const merged = [];
  for (const segment of raw) {
    if (merged.length && shouldMerge(merged[merged.length - 1], segment)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${segment}`.trim();
    } else {
      merged.push(segment);
    }
  }

  return merged.flatMap((sentence) => splitLongSentence(sentence));
}

/**
 * Parse notes into display blocks and a flat list of sentences.
 * Each sentence keeps its global index so the player and renderer stay in sync.
 */
export function parseNote(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split('\n');
  const blocks = [];
  const sentences = [];
  let paragraph = [];

  function addBlock(type, content, marker = '') {
    const clean = cleanInline(content);
    if (!clean) return;
    const parts = splitSentences(clean);
    if (!parts.length) return;
    const blockSentences = parts.map((sentence) => {
      const item = { text: sentence, index: sentences.length };
      sentences.push(item);
      return item;
    });
    blocks.push({ type, marker, sentences: blockSentences });
  }

  function flushParagraph() {
    if (!paragraph.length) return;
    addBlock('p', paragraph.join(' '));
    paragraph = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph();
      continue;
    }
    if (isSeparator(line)) {
      flushParagraph();
      continue;
    }

    const table = tableCells(line);
    if (table) {
      flushParagraph();
      if (!table.separator && table.cells.length) addBlock('table', table.cells.join(' · '));
      continue;
    }

    const heading = headingMatch(line);
    if (heading) {
      flushParagraph();
      addBlock('h', heading[1]);
      continue;
    }

    const bullet = bulletMatch(line);
    if (bullet) {
      flushParagraph();
      addBlock('li', bullet[2], bullet[1] ? `${bullet[1]}.` : '•');
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph();
      addBlock('p', line.replace(/^\s*>\s?/, ''));
      continue;
    }

    if (/^\s*\|/.test(line)) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }
  flushParagraph();

  const lang = detectLanguage(text);
  return { blocks, sentences, lang };
}

export function detectLanguage(value) {
  const text = String(value || '');
  const dev = (text.match(DEVANAGARI_RE) || []).length;
  const latin = (text.match(LATIN_RE) || []).length;
  if (dev >= 6 && dev >= latin * 0.18) return 'hi';

  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  let hits = 0;
  for (const word of words) if (HINGLISH_WORDS.has(word)) hits += 1;
  if (words.length >= 4 && hits >= 3 && hits >= words.length * 0.035) return 'hinglish';
  if (words.length > 0 && words.length < 12 && hits >= 2) return 'hinglish';
  return 'en';
}

export function languageLabel(lang) {
  return { en: 'English', hi: 'हिंदी', hinglish: 'Hinglish' }[lang] || 'English';
}

export function speechLocale(lang) {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'hinglish') return 'en-IN';
  return 'en-IN';
}

export function extractTitle(value, fallback = 'Untitled note') {
  const text = normalizeText(value);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return fallback;

  let first = lines[0];
  const heading = headingMatch(first);
  if (heading) first = heading[1];
  first = cleanInline(first)
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d{1,3}[.)]\s+/, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/[.:;,\s]+$/, '')
    .trim();

  if (!first) return fallback;
  if (first.length > 82) {
    const cut = first.slice(0, 78);
    const space = cut.lastIndexOf(' ');
    first = `${cut.slice(0, space > 50 ? space : 78).trim()}…`;
  }
  return first;
}

/**
 * Drop the leading title, which becomes the note title, so the reader does not
 * repeat it. Handles a markdown heading or a standalone first line.
 * If the title is the whole note, keep it so the note is never empty.
 */
export function stripLeadingTitle(value) {
  const text = normalizeText(value);
  const heading = text.match(/^\s*#{1,6}[ \t]+[^\n]+(?:\n|$)/);
  if (heading) {
    const rest = text.slice(heading[0].length).replace(/^\s*\n/, '').trim();
    return rest || text;
  }

  const firstLine = text.match(/^\s*([^\n]+)\n/);
  if (!firstLine) return text;
  const after = text.slice(firstLine[0].length);
  if (!/^\s*\n/.test(after)) return text;

  const rawLine = firstLine[1].trim();
  if (!rawLine || /^[-*+]\s+/.test(rawLine) || /^\d{1,3}[.)]\s+/.test(rawLine)) return text;

  const line = cleanInline(rawLine);
  if (!line || line.length > 100 || line.split(/\s+/).length > 14) return text;
  if (/[.!?।॥]$/.test(line)) return text;

  const rest = after.replace(/^\s*\n/, '').trim();
  return rest || text;
}


export function previewText(value, max = 150) {
  const text = splitSentences(normalizeText(value).replace(/\n+/g, ' ')).join(' ');
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

export function countWords(value) {
  const matches = String(value || '').trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function estimateMinutes(value, rate = 1) {
  const words = countWords(value);
  const wpm = 145 * Math.max(0.5, rate);
  return Math.max(1, Math.ceil(words / wpm));
}

export function estimateSentenceMinutes(sentences, rate = 1) {
  const words = sentences.reduce((total, item) => total + countWords(item.text || item), 0);
  return Math.max(1, Math.ceil(words / (145 * Math.max(0.5, rate))));
}
