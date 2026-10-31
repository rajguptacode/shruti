/** Small localStorage layer. No server, no account, no tracking. */
import { parseNote, estimateSentenceMinutes, previewText, extractTitle } from './text.js';

const PREFIX = 'shruti.v1.';
const INDEX_KEY = `${PREFIX}index`;
const NOTE_KEY = (id) => `${PREFIX}note.${id}`;
const SETTINGS_KEY = `${PREFIX}settings`;
const DRAFT_KEY = `${PREFIX}draft`;

export const DEFAULT_SETTINGS = {
  theme: 'system',
  rate: 1,
  voiceURI: '',
  fontSize: 19,
  autoScroll: true,
  keepAwake: true,
  lastNoteId: null
};

export function storageAvailable() {
  try {
    const key = `${PREFIX}probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadIndex() {
  const index = readJSON(INDEX_KEY, []);
  if (!Array.isArray(index)) return [];
  return index
    .filter((item) => item && typeof item.id === 'string')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function saveIndex(index) {
  writeJSON(INDEX_KEY, index);
}

function metaFromNote(note) {
  const parsed = parseNote(note.text);
  return {
    id: note.id,
    title: note.title,
    lang: note.lang,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    preview: previewText(note.text),
    sentenceCount: parsed.sentences.length,
    minutes: estimateSentenceMinutes(parsed.sentences)
  };
}

export function makeNote({ text, title, lang, langAuto = true }) {
  const now = Date.now();
  const cleanTitle = (title || '').trim() || extractTitle(text);
  return {
    id: createId(),
    title: cleanTitle,
    text,
    lang,
    langAuto,
    position: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function saveNote(note, { touch = true, skipIndex = false } = {}) {
  const next = { ...note };
  if (touch) next.updatedAt = Date.now();
  writeJSON(NOTE_KEY(next.id), next);

  if (!skipIndex) {
    const index = loadIndex().filter((item) => item.id !== next.id);
    index.push(metaFromNote(next));
    saveIndex(index);
  }
  return next;
}

export function savePosition(noteId, position) {
  const note = loadNote(noteId);
  if (!note) return null;
  note.position = position;
  writeJSON(NOTE_KEY(note.id), note);
  return note;
}

export function loadNote(id) {
  if (!id) return null;
  const note = readJSON(NOTE_KEY(id), null);
  if (!note || typeof note.text !== 'string') return null;
  return {
    position: 0,
    langAuto: true,
    createdAt: note.createdAt || Date.now(),
    updatedAt: note.updatedAt || Date.now(),
    ...note
  };
}

export function deleteNote(id) {
  try { localStorage.removeItem(NOTE_KEY(id)); } catch (error) {}
  const index = loadIndex().filter((item) => item.id !== id);
  saveIndex(index);
  return index;
}

export function allNotes() {
  return loadIndex().map((item) => loadNote(item.id)).filter(Boolean);
}

export function clearAllNotes() {
  const index = loadIndex();
  for (const item of index) {
    try { localStorage.removeItem(NOTE_KEY(item.id)); } catch (error) {}
  }
  try {
    localStorage.removeItem(INDEX_KEY);
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {}
}

export function exportBackup() {
  const notes = allNotes();
  return {
    app: 'shruti',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes
  };
}

function isValidNote(note) {
  return note && typeof note.id === 'string' && typeof note.text === 'string' && note.text.trim().length > 0;
}

export function importBackup(payload) {
  if (!payload || !Array.isArray(payload.notes)) throw new Error('This file does not look like a Shruti backup.');
  const existing = new Map(loadIndex().map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of payload.notes) {
    if (!isValidNote(item)) { skipped += 1; continue; }
    const old = existing.get(item.id);
    if (old && (old.updatedAt || 0) > (item.updatedAt || 0)) { skipped += 1; continue; }
    const note = {
      ...item,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : extractTitle(item.text),
      lang: ['en', 'hi', 'hinglish'].includes(item.lang) ? item.lang : 'en',
      langAuto: Boolean(item.langAuto),
      position: Number.isInteger(item.position) ? item.position : 0,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now()
    };
    try {
      saveNote(note, { touch: false });
      if (old) updated += 1; else added += 1;
    } catch (error) {
      skipped += 1;
    }
  }
  return { added, updated, skipped };
}

export function loadSettings() {
  const saved = readJSON(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveSettings(settings) {
  try {
    writeJSON(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...settings });
    return true;
  } catch (error) {
    return false;
  }
}

export function loadDraft() {
  const draft = readJSON(DRAFT_KEY, null);
  if (!draft || typeof draft.text !== 'string') return null;
  return {
    text: draft.text,
    lang: ['auto', 'en', 'hi', 'hinglish'].includes(draft.lang) ? draft.lang : 'auto'
  };
}

export function saveDraft(draft) {
  try {
    writeJSON(DRAFT_KEY, { text: String(draft.text || '').slice(0, 200000), lang: draft.lang || 'auto' });
  } catch (error) {}
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (error) {}
}
