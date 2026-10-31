import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const store = await import('../js/store.js');

beforeEach(() => {
  localStorage.clear();
});

test('saves, loads and indexes notes', () => {
  const note = store.makeNote({ text: '# Test\n\nOne sentence. Two sentences.', lang: 'en', langAuto: false });
  const saved = store.saveNote(note);
  assert.equal(saved.title, 'Test');
  const index = store.loadIndex();
  assert.equal(index.length, 1);
  assert.equal(index[0].sentenceCount, 3);
  assert.equal(store.loadNote(note.id).text, note.text);
});

test('saves playback position without touching updatedAt', () => {
  const note = store.makeNote({ text: 'One. Two. Three.', lang: 'en' });
  const saved = store.saveNote(note);
  const position = store.savePosition(saved.id, 2);
  assert.equal(position.position, 2);
  assert.equal(store.loadNote(saved.id).updatedAt, saved.updatedAt);
});

test('deletes notes', () => {
  const note = store.saveNote(store.makeNote({ text: 'One. Two.', lang: 'en' }));
  store.deleteNote(note.id);
  assert.equal(store.loadIndex().length, 0);
  assert.equal(store.loadNote(note.id), null);
});

test('exports and imports a backup', () => {
  const note = store.saveNote(store.makeNote({ text: 'One. Two.', lang: 'en' }));
  const backup = store.exportBackup();
  assert.equal(backup.app, 'shruti');
  assert.equal(backup.notes.length, 1);
  store.clearAllNotes();
  const result = store.importBackup(backup);
  assert.deepEqual(result, { added: 1, updated: 0, skipped: 0 });
  assert.equal(store.loadIndex().length, 1);
});

test('prefers newer notes when importing duplicates', () => {
  const note = store.saveNote(store.makeNote({ text: 'Old text. More.', lang: 'en' }));
  const backup = store.exportBackup();
  backup.notes[0].text = 'Newer text. More.';
  backup.notes[0].updatedAt = note.updatedAt + 1000;
  const result = store.importBackup(backup);
  assert.equal(result.updated, 1);
  assert.equal(store.loadNote(note.id).text, 'Newer text. More.');
});

test('stores settings and drafts', () => {
  const settings = store.loadSettings();
  assert.equal(settings.rate, 1);
  assert.equal(store.saveSettings({ ...settings, rate: 1.25 }), true);
  assert.equal(store.loadSettings().rate, 1.25);
  store.saveDraft({ text: 'draft text', lang: 'hi' });
  assert.deepEqual(store.loadDraft(), { text: 'draft text', lang: 'hi' });
  store.clearDraft();
  assert.equal(store.loadDraft(), null);
});
