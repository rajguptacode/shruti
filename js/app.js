/** Shruti — paste notes, listen, remember. */
import {
  parseNote, detectLanguage, languageLabel, speechLocale,
  estimateSentenceMinutes, extractTitle, countWords, stripLeadingTitle
} from './text.js';
import * as store from './store.js';
import {
  SpeechPlayer, loadVoices, watchVoices, chooseAutoVoice, findVoice,
  sortVoicesForUI, voiceMatchesLang, isSupported
} from './speech.js';

const SAMPLES = {
  en: {
    lang: 'en',
    text: `# Photosynthesis

Photosynthesis is the process by which green plants make their own food. It takes place mainly in the leaves, inside structures called chloroplasts. The green pigment chlorophyll absorbs sunlight. This light energy is used to split water molecules and release oxygen. Carbon dioxide is then converted into glucose, which stores energy for the plant.

The overall equation is: carbon dioxide plus water, in the presence of sunlight and chlorophyll, gives glucose and oxygen. Remember that photosynthesis is the opposite of respiration.`
  },
  hi: {
    lang: 'hi',
    text: `# प्रकाश संश्लेषण

प्रकाश संश्लेषण वह प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश, जल और कार्बन डाइऑक्साइड की सहायता से अपना भोजन बनाते हैं। यह क्रिया मुख्य रूप से पत्तियों के क्लोरोप्लास्ट में होती है। क्लोरोफिल नामक हरा वर्णक सूर्य के प्रकाश को अवशोषित करता है। इस प्रक्रिया में ऑक्सीजन गैस निकलती है। बना हुआ ग्लूकोज पौधे के भोजन के रूप में संचित रहता है।`
  },
  hinglish: {
    lang: 'hinglish',
    text: `# Federalism — quick revision

Federalism ka matlab hai power ka division between the central government aur the state governments. India mein do levels of government hain. Dono ke paas apne separate subjects hain. Yeh division constitution mein likha hua hai. India ko quasi-federal kaha jata hai kyunki centre ke paas kuch special powers bhi hain. Exam mein examples zaroor likhna: Union List, State List aur Concurrent List.`
  }
};

const SPEECH_SAMPLES = {
  en: 'Hello! This is your study voice. Let us revise one sentence at a time.',
  hi: 'नमस्ते! यह आपकी अध्ययन आवाज़ है। चलिए एक-एक वाक्य दोहराते हैं।',
  hinglish: 'Hello! Aaj hum apne notes dhyan se sunenge. Ek sentence, ek idea.'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  body: document.body,
  sidebar: $('#sidebar'),
  backdrop: $('#backdrop'),
  menuBtn: $('#menu-btn'),
  sidebarClose: $('#sidebar-close'),
  brandLink: $('#brand-link'),
  brandLinkMobile: $('#brand-link-mobile'),
  newNoteBtn: $('#new-note-btn'),
  librarySearch: $('#library-search'),
  libraryCount: $('#library-count'),
  noteList: $('#note-list'),
  importSide: $('#import-side'),
  exportSide: $('#export-side'),
  settingsSide: $('#settings-side'),
  mainScroll: $('#main'),
  topbarContext: $('#topbar-context'),
  saveStatus: $('#save-status'),
  themeBtn: $('#theme-btn'),
  themeBtnIcon: $('#theme-btn-icon'),
  focusBtn: $('#focus-btn'),
  editBtn: $('#edit-btn'),
  viewComposer: $('#view-composer'),
  viewNote: $('#view-note'),
  composeText: $('#compose-text'),
  composeHint: $('#compose-hint'),
  createBtn: $('#create-btn'),
  createBtnLabel: $('#create-btn-label'),
  clearCompose: $('#clear-compose'),
  noteLang: $('#note-lang'),
  noteStats: $('#note-stats'),
  noteTitle: $('#note-title'),
  noteSubmeta: $('#note-submeta'),
  reader: $('#reader'),
  noteEnd: $('#note-end'),
  replayBtn: $('#replay-btn'),
  readProgress: $('#read-progress-fill'),
  dock: $('#dock'),
  dockTitle: $('#dock-title'),
  dockStatus: $('#dock-status'),
  progress: $('#progress'),
  playBtn: $('#play-btn'),
  prevBtn: $('#prev-btn'),
  nextBtn: $('#next-btn'),
  loopBtn: $('#loop-btn'),
  speedBtn: $('#speed-btn'),
  speedLabel: $('#speed-label'),
  timerBtn: $('#timer-btn'),
  timerLabel: $('#timer-label'),
  settingsDock: $('#settings-dock'),
  focusExit: $('#focus-exit'),
  settingsDialog: $('#settings-dialog'),
  voiceSelect: $('#voice-select'),
  voiceStatus: $('#voice-status'),
  voiceHint: $('#voice-hint'),
  testVoice: $('#test-voice'),
  rateRange: $('#rate-range'),
  rateValue: $('#rate-value'),
  fontDown: $('#font-down'),
  fontUp: $('#font-up'),
  fontValue: $('#font-value'),
  autoscrollToggle: $('#autoscroll-toggle'),
  wakelockToggle: $('#wakelock-toggle'),
  sleepStatus: $('#sleep-status'),
  sleepOptions: $('#sleep-options'),
  themes: $$('input[name="theme"]'),
  themeStatus: $('#theme-status'),
  exportSettings: $('#export-settings'),
  importSettings: $('#import-settings'),
  deleteAll: $('#delete-all'),
  installRow: $('#install-row'),
  iosInstall: $('#ios-install'),
  installBtn: $('#install-btn'),
  editDialog: $('#edit-dialog'),
  editTitleInput: $('#edit-title-input'),
  editText: $('#edit-text'),
  editLangHint: $('#edit-lang-hint'),
  editError: $('#edit-error'),
  saveEdit: $('#save-edit'),
  deleteNote: $('#delete-note'),
  confirmDialog: $('#confirm-dialog'),
  confirmDelete: $('#confirm-delete'),
  importFile: $('#import-file'),
  toastRegion: $('#toast-region'),
  offlineBanner: $('#offline-banner')
};

const state = {
  settings: store.loadSettings(),
  index: store.loadIndex(),
  note: null,
  parsed: null,
  view: 'composer',
  composeLang: 'auto',
  composeParsed: null,
  composeTimer: null,
  voices: [],
  player: new SpeechPlayer(),
  saveTitleTimer: null,
  savePositionTimer: null,
  draftTimer: null,
  sleepEndsAt: 0,
  sleepMinutes: 0,
  sleepTimer: null,
  lastUserScroll: 0,
  sentenceEls: [],
  suppressTitle: false,
  installPrompt: null,
  storageWarned: false,
  voiceWatchStop: null,
  finishedToastOpen: false,
  wakeLock: null,
  systemThemeMedia: null
};

/* ---------- small utilities ---------- */
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function formatRate(rate) {
  return `${Number(rate).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×`;
}

function plural(number, singular, pluralForm = `${singular}s`) {
  return `${number} ${number === 1 ? singular : pluralForm}`;
}

function formatUpdated(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfToday - startOfDate) / 86400000);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  if (days === 0) return `Updated today at ${time}`;
  if (days === 1) return 'Updated yesterday';
  return `Updated ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)}`;
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setSaveStatus(text, mode = '') {
  els.saveStatus.classList.toggle('is-error', mode === 'error');
  els.saveStatus.innerHTML = '';
  if (mode === 'saved') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-check');
    svg.append(use);
    els.saveStatus.append(svg);
  }
  els.saveStatus.append(document.createTextNode(text));
}

function toast(message, { action, duration = 4200 } = {}) {
  const node = document.createElement('div');
  node.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);

  let timer = null;
  const remove = () => {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 190);
  };
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      clearTimeout(timer);
      remove();
      action.onClick?.();
    });
    node.append(button);
  }
  while (els.toastRegion.children.length >= 3) els.toastRegion.firstElementChild?.remove();
  els.toastRegion.append(node);
  timer = setTimeout(remove, duration);
  return remove;
}

function persistSettings() {
  const ok = store.saveSettings(state.settings);
  if (!ok && !state.storageWarned) {
    state.storageWarned = true;
    toast('This browser is not letting Shruti save settings. Private mode may be blocking storage.', { duration: 9000 });
  }
}

function storageError() {
  if (state.storageWarned) return;
  state.storageWarned = true;
  toast('Storage is full or blocked. Export a backup and clear some browser data.', { duration: 9000 });
}

/* ---------- theme, settings, fonts ---------- */
function applyTheme(theme, { persist = false } = {}) {
  const chosen = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  const dark = chosen === 'dark' || (chosen === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#121715' : '#f3efe4');
  els.themeStatus.textContent = chosen === 'system' ? 'System' : chosen === 'light' ? 'Light' : 'Dark';
  for (const input of els.themes) input.checked = input.value === chosen;
  if (els.themeBtn) {
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    els.themeBtn.setAttribute('aria-label', label);
    els.themeBtn.title = label;
    els.themeBtnIcon?.setAttribute('href', dark ? '#i-sun' : '#i-moon');
  }
  state.settings.theme = chosen;
  if (persist) persistSettings();
}

function applyFontSize(size, { persist = false } = {}) {
  const clamped = clamp(Math.round(Number(size) || 19), 17, 24);
  state.settings.fontSize = clamped;
  document.documentElement.style.setProperty('--reader-size', `${clamped}px`);
  els.fontValue.textContent = `${clamped} px`;
  if (persist) persistSettings();
}

function applyRate(rate, { persist = false, restart = false } = {}) {
  const value = clamp(Number(rate) || 1, 0.6, 1.6);
  state.settings.rate = value;
  state.player.setRate(value);
  els.rateRange.value = String(value);
  els.rateValue.textContent = formatRate(value);
  els.speedLabel.textContent = formatRate(value);
  const percent = ((value - 0.6) / 1) * 100;
  els.rateRange.style.setProperty('--progress', `${percent}%`);
  for (const preset of $$('.preset')) {
    preset.classList.toggle('is-active', Math.abs(Number(preset.dataset.rate) - value) < 0.001);
  }
  if (persist) persistSettings();
  if (restart && state.player.playing) state.player.restartCurrent();
}

function syncSettingsUI() {
  applyTheme(state.settings.theme);
  applyFontSize(state.settings.fontSize);
  applyRate(state.settings.rate);
  els.autoscrollToggle.checked = Boolean(state.settings.autoScroll);
  els.wakelockToggle.checked = Boolean(state.settings.keepAwake);
  if (!state.voices.length) els.voiceSelect.value = '';
  else els.voiceSelect.value = state.settings.voiceURI || '';
  updateVoiceStatus();
  updateSleepUI();
  updateInstallUI();
}

/* ---------- voices ---------- */
function effectiveLang() {
  if (state.note) return state.note.lang;
  if (state.composeParsed) return state.composeParsed.lang;
  return 'en';
}

function resolvedVoice() {
  if (state.settings.voiceURI) {
    const saved = findVoice(state.voices, state.settings.voiceURI);
    if (saved) return saved;
  }
  return chooseAutoVoice(state.voices, effectiveLang());
}

function applyVoice({ restart = false } = {}) {
  const voice = resolvedVoice();
  state.player.setLang(speechLocale(effectiveLang()));
  state.player.setVoice(voice);
  updateVoiceStatus();
  if (restart && state.player.playing) state.player.restartCurrent();
}

function voiceOptionLabel(voice) {
  const online = voice.localService ? '' : ' · online';
  return `${voice.name} — ${voice.lang}${online}`;
}

function populateVoiceSelect() {
  const previous = state.settings.voiceURI || '';
  els.voiceSelect.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Automatic voice (recommended)';
  els.voiceSelect.append(auto);
  if (!state.voices.length) {
    const none = document.createElement('option');
    none.value = '';
    none.disabled = true;
    none.textContent = 'No voices found on this device yet';
    els.voiceSelect.append(none);
    els.voiceSelect.value = '';
    return;
  }

  const groups = [
    { label: 'Indian voices', test: (v) => /^(hi|en-in)/i.test(v.lang.replace('_', '-')) },
    { label: 'Other English voices', test: (v) => /^en/i.test(v.lang.replace('_', '-')) },
    { label: 'Other languages', test: () => true }
  ];
  const used = new Set();
  for (const group of groups) {
    const matches = state.voices.filter((voice) => !used.has(voice.voiceURI) && group.test(voice));
    if (!matches.length) continue;
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const voice of matches) {
      used.add(voice.voiceURI);
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = voiceOptionLabel(voice);
      optgroup.append(option);
    }
    els.voiceSelect.append(optgroup);
  }
  const valid = previous && state.voices.some((voice) => voice.voiceURI === previous);
  els.voiceSelect.value = valid ? previous : '';
}

function updateVoiceStatus() {
  if (!isSupported()) {
    els.voiceStatus.textContent = 'Not supported';
    els.voiceHint.textContent = 'This browser cannot read text aloud. Try Chrome, Edge, Safari or Firefox on a device with voices installed.';
    els.testVoice.disabled = true;
    return;
  }
  const voice = state.player.voice;
  const lang = effectiveLang();
  if (!state.voices.length) {
    els.voiceStatus.textContent = 'No voices found';
    els.voiceHint.textContent = 'Your browser has not reported any installed voices yet. If you are on Android, install Hindi voice data in Text-to-speech settings, then reload.';
  } else if (voice) {
    els.voiceStatus.textContent = `${voice.name} · ${voice.lang}`;
    const mismatch = lang === 'hi' && !voiceMatchesLang(voice, 'hi');
    const manualFound = Boolean(state.settings.voiceURI && findVoice(state.voices, state.settings.voiceURI));
    els.voiceHint.textContent = mismatch
      ? 'This is not a Hindi voice, so Hindi words may sound wrong. Add or choose a हिंदी voice above.'
      : manualFound
        ? 'Using your chosen voice. Automatic follows each note’s language.'
        : state.settings.voiceURI
          ? 'Your saved voice is not available here, so Shruti picked the best installed voice instead.'
          : 'Automatic picked the best installed voice for this note.';
  } else {
    els.voiceStatus.textContent = 'System default';
    els.voiceHint.textContent = 'No matching voice was found, so the browser will use its default. You can install a Hindi voice in your device settings.';
  }
  els.testVoice.disabled = false;
}

async function refreshVoices() {
  const voices = await loadVoices();
  applyVoiceList(voices);
  if (!state.voiceWatchStop) {
    state.voiceWatchStop = watchVoices((next) => applyVoiceList(next));
  }
}

function applyVoiceList(voices) {
  state.voices = sortVoicesForUI(voices || []);
  populateVoiceSelect();
  applyVoice({ restart: false });
  if (state.view === 'note' && !state.voices.length && !state.settings.voiceURI) {
    // Keep quiet; the settings panel has full instructions.
  }
}

function testVoice() {
  if (!isSupported()) { toast('This browser does not support speech.'); return; }
  if (state.player.playing) { toast('Pause the note first, then test a voice.'); return; }
  if (!state.voices.length) {
    toast('No device voices found yet. Install a voice in your system text-to-speech settings.', {
      duration: 9000,
      action: { label: 'Voice settings', onClick: () => openSettings('voice-section') }
    });
    return;
  }
  const lang = effectiveLang();
  const text = SPEECH_SAMPLES[lang] || SPEECH_SAMPLES.en;
  if (!state.player.testVoice(text)) toast('Could not start the voice test.');
}

/* ---------- composer ---------- */
function checkedComposeLang() {
  return $('input[name="compose-lang"]:checked')?.value || 'auto';
}

function setComposeLang(lang) {
  state.composeLang = lang;
  const input = $(`input[name="compose-lang"][value="${lang}"]`);
  if (input) input.checked = true;
  updateComposeHint();
}

function updateComposeHint() {
  const text = els.composeText.value;
  const hasText = Boolean(text.trim());
  els.createBtn.disabled = !hasText;
  els.clearCompose.hidden = !hasText;
  if (!hasText) {
    els.composeHint.textContent = state.settings.voiceURI
      ? 'Your notes never leave this device.'
      : 'Your notes never leave this device · language detected automatically.';
    els.createBtnLabel.textContent = 'Start listening';
    return;
  }

  const parsed = state.composeParsed || parseNote(stripLeadingTitle(text));
  const lang = state.composeLang === 'auto' ? parsed.lang : state.composeLang;
  const minutes = estimateSentenceMinutes(parsed.sentences);
  const detected = state.composeLang === 'auto' ? `Detected ${languageLabel(parsed.lang)} · ` : '';
  els.composeHint.textContent = `${detected}${plural(parsed.sentences.length, 'sentence')} · about ${minutes} min listen`;
  els.createBtnLabel.textContent = `Start listening · ${minutes} min`;
}

function scheduleComposeParse() {
  clearTimeout(state.composeTimer);
  state.composeTimer = setTimeout(() => {
    const text = els.composeText.value;
    state.composeParsed = text.trim() ? parseNote(stripLeadingTitle(text)) : null;
    updateComposeHint();
  }, 180);
}

function saveComposeDraftSoon() {
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(() => {
    const text = els.composeText.value;
    if (text.trim()) store.saveDraft({ text, lang: state.composeLang });
    else store.clearDraft();
  }, 420);
}

function flushTitle() {
  clearTimeout(state.saveTitleTimer);
  if (state.note && state.note._dirtyTitle) saveTitle();
}

function showComposer({ restoreDraft = true } = {}) {
  closeSidebar();
  exitFocus();
  flushTitle();
  state.player.stop();
  flushPosition();
  state.note = null;
  state.parsed = null;
  state.view = 'composer';
  state.finishedToastOpen = false;
  els.body.classList.remove('has-note');
  els.viewNote.hidden = true;
  els.viewComposer.hidden = false;
  els.dock.hidden = true;
  els.topbarContext.textContent = 'New note';
  els.saveStatus.textContent = '';
  els.noteTitle.value = '';
  document.title = 'Shruti — turn your notes into audio';
  renderLibrary();
  updateReaderProgress(0, 0);
  if (restoreDraft && !els.composeText.value) {
    const draft = store.loadDraft();
    if (draft?.text) {
      els.composeText.value = draft.text;
      setComposeLang(draft.lang || 'auto');
    }
  }
  state.composeParsed = els.composeText.value.trim() ? parseNote(stripLeadingTitle(els.composeText.value)) : null;
  updateComposeHint();
  els.mainScroll.scrollTop = 0;
}

function createNote() {
  const rawText = els.composeText.value.trim();
  if (!rawText) return;
  const title = extractTitle(rawText);
  const text = stripLeadingTitle(rawText);
  const parsed = parseNote(text);
  if (!parsed.sentences.length) {
    toast('There is no readable text here yet.');
    return;
  }
  const requested = checkedComposeLang();
  const lang = requested === 'auto' ? parsed.lang : requested;
  const note = store.makeNote({ text, title, lang, langAuto: requested === 'auto' });

  try {
    store.saveNote(note);
  } catch (error) {
    storageError();
    return;
  }
  store.clearDraft();
  state.index = store.loadIndex();
  els.composeText.value = '';
  state.composeParsed = null;
  setComposeLang('auto');
  updateComposeHint();
  renderLibrary();
  openNote(note.id, { play: true, scroll: 'start' });
}

function clearComposer() {
  els.composeText.value = '';
  state.composeParsed = null;
  store.clearDraft();
  updateComposeHint();
  els.composeText.focus();
}

/* ---------- note rendering ---------- */
function renderReader() {
  els.reader.innerHTML = '';
  state.sentenceEls = [];
  if (!state.parsed) return;
  const fragment = document.createDocumentFragment();

  for (const block of state.parsed.blocks) {
    let element;
    if (block.type === 'h') {
      element = document.createElement('h2');
      element.className = 'reader__heading';
    } else if (block.type === 'li') {
      element = document.createElement('p');
      element.className = 'reader__block reader__bullet';
      const marker = document.createElement('span');
      marker.className = 'reader__marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = block.marker || '•';
      element.append(marker);
    } else if (block.type === 'table') {
      element = document.createElement('p');
      element.className = 'reader__block reader__table-row';
    } else {
      element = document.createElement('p');
      element.className = 'reader__block';
    }

    block.sentences.forEach((sentence, index) => {
      const span = document.createElement('span');
      span.className = 'sentence';
      span.dataset.index = String(sentence.index);
      span.textContent = sentence.text;
      span.title = 'Listen from this sentence';
      element.append(span);
      state.sentenceEls[sentence.index] = span;
      if (index < block.sentences.length - 1) element.append(document.createTextNode(' '));
    });
    fragment.append(element);
  }
  els.reader.append(fragment);
  highlightSentence(state.player.index, { scroll: false });
}

function renderNote() {
  if (!state.note || !state.parsed) return;
  els.body.classList.add('has-note');
  els.noteLang.textContent = languageLabel(state.note.lang);
  const minutes = estimateSentenceMinutes(state.parsed.sentences);
  els.noteStats.textContent = `${plural(state.parsed.sentences.length, 'sentence')} · ~${minutes} min at 1×`;
  els.noteSubmeta.textContent = `${countWords(state.note.text)} words · ${formatUpdated(state.note.updatedAt)}`;
  state.suppressTitle = true;
  els.noteTitle.value = state.note.title;
  state.suppressTitle = false;
  els.dockTitle.textContent = state.note.title;
  els.topbarContext.textContent = `Your notes / ${state.note.title}`;
  document.title = `${state.note.title} — Shruti`;
  renderReader();
  syncPlayerUI(state.player.snapshot());
}

function openNote(id, { play = false, scroll = 'saved' } = {}) {
  flushTitle();
  flushPosition();
  let note;
  try { note = store.loadNote(id); } catch (error) { note = null; }
  if (!note) {
    toast('That note could not be opened. It may have been deleted.');
    state.index = store.loadIndex();
    renderLibrary();
    if (!state.index.length) showComposer();
    return;
  }

  const previousId = state.note?.id;
  if (previousId && previousId !== id) state.player.stop();
  const preparedText = stripLeadingTitle(note.text);
  if (preparedText !== note.text) {
    note.text = preparedText;
    try { store.saveNote(note, { touch: false }); } catch (error) {}
    state.index = store.loadIndex();
  }
  const parsed = parseNote(note.text);
  if (note.langAuto && note.lang !== parsed.lang) {
    note.lang = parsed.lang;
    try { store.saveNote(note, { touch: false }); } catch (error) {}
    state.index = store.loadIndex();
  }
  state.note = note;
  state.parsed = parsed;
  state.view = 'note';
  state.finishedToastOpen = false;

  closeSidebar();
  els.viewComposer.hidden = true;
  els.viewNote.hidden = false;
  els.dock.hidden = false;
  els.body.classList.add('has-note');
  els.saveStatus.textContent = '';
  state.settings.lastNoteId = id;
  persistSettings();

  state.player.load(parsed.sentences, note.position);
  applyVoice({ restart: false });
  state.player.setRate(state.settings.rate);
  renderNote();
  renderLibrary();
  updateMediaSession();
  syncPlayerUI(state.player.snapshot());

  requestAnimationFrame(() => {
    if (scroll === 'start' || !note.position) {
      els.mainScroll.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      const target = state.sentenceEls[state.player.index];
      target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  });

  if (play) {
    state.player.play();
  }
}

function showNoteViewIfNeeded() {
  if (state.view !== 'note') return;
  els.viewComposer.hidden = true;
  els.viewNote.hidden = false;
  els.dock.hidden = false;
}

function highlightSentence(index, { scroll = true, behavior = 'smooth' } = {}) {
  const previous = els.reader.querySelector('.sentence.is-current');
  previous?.classList.remove('is-current');
  const target = state.sentenceEls[index];
  target?.classList.add('is-current');
  updateReaderProgress(index, state.player.total);
  if (target && scroll && state.settings.autoScroll) {
    if (Date.now() - state.lastUserScroll > 2400 || behavior === 'auto') {
      target.scrollIntoView({ block: 'center', behavior });
    }
  }
}

function updateReaderProgress(index, total) {
  const percent = total > 0 ? ((index + 1) / total) * 100 : 0;
  els.readProgress.style.width = `${percent}%`;
}

function updatePlayerProgress(snapshot) {
  const total = snapshot.total || 0;
  const max = Math.max(1, total - 1);
  els.progress.max = String(max);
  els.progress.value = String(clamp(snapshot.index, 0, max));
  const percent = total > 1 ? (snapshot.index / (total - 1)) * 100 : 0;
  els.progress.style.setProperty('--progress', `${percent}%`);
  els.progress.disabled = total <= 1;
  els.progress.setAttribute('aria-valuetext', total ? `Sentence ${snapshot.index + 1} of ${total}` : 'No sentences');
}

function syncPlayerUI(snapshot) {
  const active = Boolean(state.note) && state.view === 'note';
  els.dock.hidden = !active;
  if (!active) return;

  els.dock.classList.toggle('is-playing', snapshot.playing && !snapshot.paused);
  els.playBtn.classList.toggle('is-playing', snapshot.playing && !snapshot.paused);
  const isPlaying = snapshot.playing && !snapshot.paused;
  els.playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  els.playBtn.title = isPlaying ? 'Pause (Space)' : 'Play (Space)';
  els.loopBtn.setAttribute('aria-pressed', String(Boolean(snapshot.loop)));
  els.loopBtn.classList.toggle('is-active', Boolean(snapshot.loop));

  const total = snapshot.total || 0;
  let status;
  if (!total) status = 'No sentences';
  else if (snapshot.finished) status = 'Finished · tap play to replay';
  else if (snapshot.paused) status = `Paused · sentence ${snapshot.index + 1} of ${total}`;
  else if (isPlaying) status = `Playing · sentence ${snapshot.index + 1} of ${total}`;
  else status = `Ready · sentence ${snapshot.index + 1} of ${total}`;
  els.dockStatus.textContent = status;
  els.dockTitle.textContent = state.note?.title || 'Note';

  els.reader.classList.toggle('is-playing', isPlaying);
  updatePlayerProgress(snapshot);
  highlightSentence(snapshot.index, { scroll: isPlaying && state.view === 'note' });
  updateMediaSession();
}

/* ---------- title editing ---------- */
function scheduleTitleSave() {
  setSaveStatus('Saving…');
  clearTimeout(state.saveTitleTimer);
  state.saveTitleTimer = setTimeout(saveTitle, 520);
}

function saveTitle() {
  if (!state.note) return;
  clearTimeout(state.saveTitleTimer);
  let title = els.noteTitle.value.trim();
  if (!title) {
    title = extractTitle(state.note.text);
    els.noteTitle.value = title;
  }
  if (title === state.note.title && !state.note._dirtyTitle) {
    setSaveStatus('Saved', 'saved');
    return;
  }
  state.note.title = title;
  delete state.note._dirtyTitle;
  try {
    state.note = store.saveNote(state.note);
    state.index = store.loadIndex();
    renderLibrary();
    els.dockTitle.textContent = title;
    els.topbarContext.textContent = `Your notes / ${title}`;
    document.title = `${title} — Shruti`;
    setSaveStatus('Saved', 'saved');
  } catch (error) {
    setSaveStatus('Could not save', 'error');
    storageError();
  }
}

function onTitleInput() {
  if (!state.note || state.suppressTitle) return;
  state.note.title = els.noteTitle.value;
  state.note._dirtyTitle = true;
  scheduleTitleSave();
}

/* ---------- edit dialog ---------- */
function detectEditLangHint() {
  const text = els.editText.value;
  const requested = $('input[name="edit-lang"]:checked')?.value || 'auto';
  if (!text.trim()) {
    els.editLangHint.textContent = '';
    return;
  }
  const detected = detectLanguage(text);
  els.editLangHint.textContent = requested === 'auto'
    ? `Auto detects this as ${languageLabel(detected)}.`
    : `Reading as ${languageLabel(requested)}.`;
}

function openEditDialog() {
  if (!state.note) return;
  if (state.player.playing && !state.player.paused) state.player.pause();
  flushTitle();
  flushPosition();
  els.editTitleInput.value = state.note.title;
  els.editText.value = state.note.text;
  const langValue = state.note.langAuto ? 'auto' : state.note.lang;
  const radio = $(`input[name="edit-lang"][value="${langValue}"]`);
  if (radio) radio.checked = true;
  els.editError.hidden = true;
  detectEditLangHint();
  els.editDialog.showModal();
  document.body.classList.add('dialog-open');
  setTimeout(() => els.editTitleInput.focus(), 60);
}

function saveEdit() {
  if (!state.note) return;
  const rawText = els.editText.value.trim();
  if (!rawText) {
    els.editError.textContent = 'Add some text before saving.';
    els.editError.hidden = false;
    els.editText.focus();
    return;
  }
  const text = stripLeadingTitle(rawText);
  const title = els.editTitleInput.value.trim() || extractTitle(rawText);
  const requested = $('input[name="edit-lang"]:checked')?.value || 'auto';
  const parsed = parseNote(text);
  const lang = requested === 'auto' ? parsed.lang : requested;
  const textChanged = text !== state.note.text;
  const updated = {
    ...state.note,
    title,
    text,
    lang,
    langAuto: requested === 'auto',
    position: textChanged ? 0 : state.note.position
  };
  delete updated._dirtyTitle;
  try {
    state.note = store.saveNote(updated);
  } catch (error) {
    els.editError.textContent = 'Could not save. Browser storage may be full.';
    els.editError.hidden = false;
    return;
  }
  state.index = store.loadIndex();
  els.editDialog.close();
  state.player.stop();
  openNote(state.note.id, { scroll: textChanged ? 'start' : 'saved' });
  toast('Note updated');
}

/* ---------- deleting ---------- */
function deleteNoteById(id) {
  let note;
  try { note = store.loadNote(id); } catch (error) { note = null; }
  if (!note) return;
  const wasCurrent = state.note?.id === id;
  if (wasCurrent) {
    clearTimeout(state.saveTitleTimer);
    state.player.stop();
  }
  try {
    state.index = store.deleteNote(id);
  } catch (error) {
    toast('Could not delete this note.');
    return;
  }
  renderLibrary();

  if (wasCurrent) {
    state.note = null;
    const next = state.index[0];
    if (next) openNote(next.id);
    else showComposer({ restoreDraft: false });
  }

  toast(`“${note.title}” deleted`, {
    duration: 7000,
    action: {
      label: 'Undo',
      onClick: () => {
        try {
          store.saveNote(note, { touch: false });
          state.index = store.loadIndex();
          renderLibrary();
          openNote(note.id);
          toast('Note restored');
        } catch (error) {
          storageError();
        }
      }
    }
  });
}

/* ---------- library ---------- */
function renderLibrary() {
  const query = els.librarySearch.value.trim().toLowerCase();
  const total = state.index.length;
  els.libraryCount.textContent = String(total);
  if (!total) {
    els.noteList.innerHTML = '<div class="library-empty"><svg class="icon"><use href="#i-headphones"/></svg>No notes yet.<br>Paste something you want to remember.</div>';
    return;
  }
  const visible = query
    ? state.index.filter((item) => `${item.title} ${item.preview} ${languageLabel(item.lang)}`.toLowerCase().includes(query))
    : state.index;

  els.noteList.innerHTML = '';
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.textContent = `No notes match “${els.librarySearch.value.trim()}”.`;
    els.noteList.append(empty);
    return;
  }

  for (const item of visible) {
    const wrap = document.createElement('div');
    wrap.className = 'note-item-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-item';
    button.dataset.id = item.id;
    if (state.note?.id === item.id) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }
    button.title = item.title;

    const title = document.createElement('span');
    title.className = 'note-item__title';
    title.textContent = item.title;

    const preview = document.createElement('span');
    preview.className = 'note-item__preview';
    preview.textContent = item.preview || 'Empty note';

    const meta = document.createElement('span');
    meta.className = 'note-item__meta';
    const language = document.createElement('span');
    language.textContent = languageLabel(item.lang);
    const minutes = document.createElement('span');
    minutes.textContent = `${item.minutes || 1} min`;
    meta.append(language, minutes);

    button.append(title, preview, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'note-item__delete';
    remove.dataset.id = item.id;
    remove.setAttribute('aria-label', `Delete ${item.title}`);
    remove.title = 'Delete note';
    remove.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';

    wrap.append(button, remove);
    els.noteList.append(wrap);
  }
}

/* ---------- player wiring ---------- */
function savePositionSoon(index) {
  if (!state.note) return;
  state.note.position = index;
  clearTimeout(state.savePositionTimer);
  state.savePositionTimer = setTimeout(() => {
    if (!state.note) return;
    try { store.savePosition(state.note.id, state.note.position); } catch (error) { storageError(); }
  }, 420);
}

function flushPosition() {
  clearTimeout(state.savePositionTimer);
  if (!state.note) return;
  try { store.savePosition(state.note.id, state.note.position); } catch (error) {}
}

function togglePlay() {
  if (!state.note) { showComposer(); return; }
  if (!state.player.total) { toast('This note has no sentences to read.'); return; }
  if (state.player.finished) {
    state.player.seek(0);
    state.player.play();
  } else {
    state.player.toggle();
  }
}

function seekAndScroll(index, behavior = 'smooth') {
  state.player.seek(index);
  if (state.view === 'note') {
    state.lastUserScroll = 0;
    state.sentenceEls[state.player.index]?.scrollIntoView({ block: 'center', behavior });
  }
}

function changeSleepTimer(minutes) {
  clearInterval(state.sleepTimer);
  state.sleepTimer = null;
  state.sleepMinutes = Number(minutes) || 0;
  if (!state.sleepMinutes) {
    state.sleepEndsAt = 0;
    updateSleepUI();
    return;
  }
  state.sleepEndsAt = Date.now() + state.sleepMinutes * 60000;
  state.sleepTimer = setInterval(tickSleepTimer, 1000);
  updateSleepUI();
}

function tickSleepTimer() {
  if (!state.sleepEndsAt) return;
  const remaining = state.sleepEndsAt - Date.now();
  if (remaining <= 0) {
    clearInterval(state.sleepTimer);
    state.sleepTimer = null;
    state.sleepEndsAt = 0;
    state.sleepMinutes = 0;
    if (state.player.playing && !state.player.paused) state.player.pause();
    updateSleepUI();
    toast('Sleep timer ended — playback paused.');
    return;
  }
  updateSleepUI();
}

function updateSleepUI() {
  const active = state.sleepEndsAt > 0;
  const remaining = active ? state.sleepEndsAt - Date.now() : 0;
  els.sleepStatus.textContent = active ? `${formatClock(remaining)} left` : 'Off';
  els.timerLabel.textContent = active ? formatClock(remaining) : 'Timer';
  els.timerBtn.classList.toggle('is-active', active);
  for (const chip of $$('#sleep-options .chip')) {
    const minutes = Number(chip.dataset.sleep) || 0;
    chip.classList.toggle('is-active', minutes === state.sleepMinutes);
  }
}

/* ---------- media session & wake lock ---------- */
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => state.player.play(),
    pause: () => state.player.pause(),
    previoustrack: () => state.player.prev(),
    nexttrack: () => state.player.next(),
    stop: () => state.player.stop()
  };
  for (const [name, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(name, handler); } catch (error) {}
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !state.note) return;
  try {
    const artwork = [
      { src: new URL('assets/icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' },
      { src: new URL('assets/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }
    ];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.note.title,
      artist: 'Shruti · audio study notes',
      album: languageLabel(state.note.lang),
      artwork
    });
    navigator.mediaSession.playbackState = state.player.playing && !state.player.paused ? 'playing' : 'paused';
  } catch (error) {}
}

async function requestWakeLock() {
  if (!state.settings.keepAwake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  if (state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (error) {
    state.wakeLock = null;
  }
}

function releaseWakeLock() {
  if (!state.wakeLock) return;
  try { state.wakeLock.release(); } catch (error) {}
  state.wakeLock = null;
}

/* ---------- focus mode & sidebar ---------- */
function enterFocus() {
  if (state.view !== 'note') return;
  document.body.classList.add('focus-mode');
  els.focusBtn.setAttribute('aria-pressed', 'true');
  els.focusExit.hidden = false;
  closeSidebar();
  state.lastUserScroll = 0;
  state.sentenceEls[state.player.index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function exitFocus() {
  document.body.classList.remove('focus-mode');
  els.focusBtn.setAttribute('aria-pressed', 'false');
  els.focusExit.hidden = true;
}

function toggleFocus() {
  if (document.body.classList.contains('focus-mode')) exitFocus();
  else enterFocus();
}

function openSidebar() {
  els.sidebar.classList.add('is-open');
  els.backdrop.hidden = false;
  els.menuBtn.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  els.sidebar.classList.remove('is-open');
  els.backdrop.hidden = true;
  els.menuBtn.setAttribute('aria-expanded', 'false');
}

/* ---------- settings, import, export ---------- */
function openSettings(sectionId = '') {
  closeSidebar();
  syncSettingsUI();
  if (!els.settingsDialog.open) {
    els.settingsDialog.showModal();
    document.body.classList.add('dialog-open');
  }
  if (!state.voices.length) refreshVoices();
  if (sectionId) {
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section) section.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 100);
  }
}

function closeAllDialogs() {
  for (const dialog of $$('dialog[open]')) dialog.close();
  document.body.classList.remove('dialog-open');
}

function downloadBackup() {
  closeSidebar();
  if (!state.index.length) { toast('There are no notes to back up yet.'); return; }
  const payload = store.exportBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `shruti-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Backup downloaded · ${plural(payload.notes.length, 'note')}`);
}

function triggerImport() {
  closeSidebar();
  els.importFile.value = '';
  els.importFile.click();
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('That backup is too large (over 8 MB).'); return; }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = Array.isArray(parsed) ? { notes: parsed } : parsed;
    const result = store.importBackup(payload);
    state.index = store.loadIndex();
    renderLibrary();
    if (state.note) openNote(state.note.id);
    const summary = [
      result.added ? `${result.added} added` : '',
      result.updated ? `${result.updated} updated` : '',
      result.skipped ? `${result.skipped} skipped` : ''
    ].filter(Boolean).join(' · ');
    toast(`Import complete${summary ? ` · ${summary}` : ''}`);
  } catch (error) {
    toast(error?.message || 'Could not import that file. Choose a Shruti backup JSON file.');
  } finally {
    event.target.value = '';
  }
}

function confirmDeleteAll() {
  if (!state.index.length) { toast('There are no notes to delete.'); return; }
  if (els.settingsDialog.open) els.settingsDialog.close();
  if (!els.confirmDialog.open) {
    els.confirmDialog.showModal();
    document.body.classList.add('dialog-open');
  }
}

function deleteAllNotes() {
  try {
    store.clearAllNotes();
  } catch (error) {
    toast('Could not clear all notes.');
    return;
  }
  state.player.stop();
  state.index = [];
  state.note = null;
  renderLibrary();
  els.confirmDialog.close();
  showComposer({ restoreDraft: false });
  toast('All notes deleted.');
}

function updateInstallUI() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  els.installRow.hidden = standalone || !state.installPrompt;
  els.iosInstall.hidden = standalone || !ios || Boolean(state.installPrompt);
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  try {
    const choice = await state.installPrompt.userChoice;
    if (choice.outcome === 'accepted') toast('Shruti added to your home screen.');
  } catch (error) {}
  state.installPrompt = null;
  updateInstallUI();
}

/* ---------- event wiring ---------- */
function isTextEntry(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]')) || target.isContentEditable;
}

function isInteractive(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]'));
}

function toggleLoop() {
  state.player.setLoop(!state.player.loop);
  state.player.emit('state', state.player.snapshot());
}

function bindEvents() {
  els.menuBtn.addEventListener('click', openSidebar);
  els.sidebarClose.addEventListener('click', closeSidebar);
  els.backdrop.addEventListener('click', closeSidebar);
  els.newNoteBtn.addEventListener('click', () => showComposer());
  els.brandLink.addEventListener('click', (event) => { event.preventDefault(); showComposer(); });
  els.brandLinkMobile.addEventListener('click', (event) => { event.preventDefault(); showComposer(); });
  els.librarySearch.addEventListener('input', renderLibrary);

  els.noteList.addEventListener('click', (event) => {
    const remove = event.target.closest('.note-item__delete');
    if (remove) {
      event.stopPropagation();
      deleteNoteById(remove.dataset.id);
      return;
    }
    const item = event.target.closest('.note-item');
    if (item) {
      closeSidebar();
      openNote(item.dataset.id);
    }
  });

  els.importSide.addEventListener('click', triggerImport);
  els.exportSide.addEventListener('click', downloadBackup);
  els.settingsSide.addEventListener('click', () => openSettings());
  els.importSettings.addEventListener('click', triggerImport);
  els.exportSettings.addEventListener('click', downloadBackup);
  els.deleteAll.addEventListener('click', confirmDeleteAll);
  els.confirmDelete.addEventListener('click', deleteAllNotes);
  els.importFile.addEventListener('change', handleImportFile);
  els.installBtn.addEventListener('click', installApp);

  els.composeText.addEventListener('input', () => {
    updateComposeHint();
    scheduleComposeParse();
    saveComposeDraftSoon();
  });
  for (const input of $$('input[name="compose-lang"]')) {
    input.addEventListener('change', () => {
      state.composeLang = checkedComposeLang();
      updateComposeHint();
      saveComposeDraftSoon();
    });
  }
  els.createBtn.addEventListener('click', createNote);
  els.clearCompose.addEventListener('click', clearComposer);
  els.themeBtn.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    applyTheme(dark ? 'light' : 'dark', { persist: true });
  });
  for (const chip of $$('[data-sample]')) {
    chip.addEventListener('click', () => {
      const sample = SAMPLES[chip.dataset.sample];
      if (!sample) return;
      els.composeText.value = sample.text;
      setComposeLang(sample.lang);
      state.composeParsed = parseNote(stripLeadingTitle(sample.text));
      updateComposeHint();
      store.saveDraft({ text: sample.text, lang: sample.lang });
      els.composeText.focus({ preventScroll: true });
    });
  }

  els.noteTitle.addEventListener('input', onTitleInput);
  els.noteTitle.addEventListener('blur', () => {
    if (!state.note) return;
    saveTitle();
  });
  els.noteTitle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); els.noteTitle.blur(); }
  });

  els.reader.addEventListener('click', (event) => {
    const sentence = event.target.closest('.sentence');
    if (!sentence || !state.note) return;
    const index = Number(sentence.dataset.index);
    if (!Number.isInteger(index)) return;
    if (state.player.finished) state.player.finished = false;
    seekAndScroll(index, 'smooth');
  });

  els.playBtn.addEventListener('click', togglePlay);
  els.prevBtn.addEventListener('click', () => { state.player.prev(); if (state.view === 'note') scrollCurrent('smooth'); });
  els.nextBtn.addEventListener('click', () => { state.player.next(); if (state.view === 'note') scrollCurrent('smooth'); });
  els.loopBtn.addEventListener('click', toggleLoop);
  els.replayBtn.addEventListener('click', () => { if (!state.note) return; state.player.seek(0); state.player.play(); });
  els.focusBtn.addEventListener('click', toggleFocus);
  els.focusExit.addEventListener('click', exitFocus);
  els.editBtn.addEventListener('click', openEditDialog);
  els.speedBtn.addEventListener('click', () => openSettings('speed-section'));
  els.timerBtn.addEventListener('click', () => openSettings('sleep-section'));
  els.settingsDock.addEventListener('click', () => openSettings());

  els.progress.addEventListener('input', () => {
    const total = state.player.total;
    const value = Number(els.progress.value);
    const percent = total > 1 ? (value / (total - 1)) * 100 : 0;
    els.progress.style.setProperty('--progress', `${percent}%`);
    els.progress.setAttribute('aria-valuetext', total ? `Sentence ${value + 1} of ${total}` : 'No sentences');
  });
  els.progress.addEventListener('change', () => {
    if (!state.player.total) return;
    seekAndScroll(Number(els.progress.value), 'smooth');
  });

  els.voiceSelect.addEventListener('change', () => {
    state.settings.voiceURI = els.voiceSelect.value;
    persistSettings();
    applyVoice({ restart: true });
  });
  els.testVoice.addEventListener('click', testVoice);

  els.rateRange.addEventListener('input', () => {
    applyRate(els.rateRange.value);
  });
  els.rateRange.addEventListener('change', () => {
    applyRate(els.rateRange.value, { persist: true, restart: true });
  });
  for (const preset of $$('.preset')) {
    preset.addEventListener('click', () => applyRate(Number(preset.dataset.rate), { persist: true, restart: true }));
  }

  els.fontDown.addEventListener('click', () => applyFontSize(state.settings.fontSize - 1, { persist: true }));
  els.fontUp.addEventListener('click', () => applyFontSize(state.settings.fontSize + 1, { persist: true }));
  els.autoscrollToggle.addEventListener('change', () => {
    state.settings.autoScroll = els.autoscrollToggle.checked;
    persistSettings();
  });
  els.wakelockToggle.addEventListener('change', () => {
    state.settings.keepAwake = els.wakelockToggle.checked;
    persistSettings();
    if (!state.settings.keepAwake) releaseWakeLock();
    else if (state.player.playing && !state.player.paused) requestWakeLock();
  });
  els.sleepOptions.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-sleep]');
    if (!chip) return;
    changeSleepTimer(Number(chip.dataset.sleep));
  });
  for (const input of els.themes) {
    input.addEventListener('change', () => applyTheme(input.value, { persist: true }));
  }

  for (const closer of $$('[data-close-dialog]')) {
    closer.addEventListener('click', () => closer.closest('dialog')?.close());
  }
  for (const dialog of $$('dialog.modal')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
    });
  }

  els.editText.addEventListener('input', detectEditLangHint);
  for (const input of $$('input[name="edit-lang"]')) input.addEventListener('change', detectEditLangHint);
  els.saveEdit.addEventListener('click', saveEdit);
  els.deleteNote.addEventListener('click', () => {
    if (!state.note) return;
    const id = state.note.id;
    els.editDialog.close();
    deleteNoteById(id);
  });

  els.mainScroll.addEventListener('wheel', markUserScroll, { passive: true });
  els.mainScroll.addEventListener('touchmove', markUserScroll, { passive: true });
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.player.playing && !state.player.paused) requestWakeLock();
    else releaseWakeLock();
  });
  window.addEventListener('beforeunload', () => { flushPosition(); saveTitleOnUnload(); });
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeSidebar(); });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    updateInstallUI();
  });
  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    updateInstallUI();
    toast('Shruti is installed. Open it from your home screen.');
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith('shruti.v1.')) return;
    state.index = store.loadIndex();
    renderLibrary();
    if (state.note && !state.index.some((item) => item.id === state.note.id)) {
      state.note = null;
      showComposer({ restoreDraft: false });
      toast('That note was deleted in another tab.');
    }
  });
}

function markUserScroll() {
  state.lastUserScroll = Date.now();
}

function scrollCurrent(behavior = 'smooth') {
  if (!state.settings.autoScroll) return;
  state.sentenceEls[state.player.index]?.scrollIntoView({ block: 'center', behavior });
}

function saveTitleOnUnload() {
  if (!state.note) return;
  clearTimeout(state.saveTitleTimer);
  const title = els.noteTitle.value.trim() || extractTitle(state.note.text);
  if (title !== state.note.title) {
    state.note.title = title;
    try { store.saveNote(state.note); } catch (error) {}
  }
}

function onKeyDown(event) {
  const target = event.target;

  if (document.querySelector('dialog[open]')) return;
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && state.view === 'composer') {
    event.preventDefault();
    createNote();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (isInteractive(target)) return;
  if (event.repeat) return;

  if (event.key === ' ' || event.key === 'Spacebar') {
    if (state.view === 'note') { event.preventDefault(); togglePlay(); }
    return;
  }
  if (event.key === 'ArrowLeft') {
    if (state.view === 'note') { event.preventDefault(); state.player.prev(); scrollCurrent('smooth'); }
    return;
  }
  if (event.key === 'ArrowRight') {
    if (state.view === 'note') { event.preventDefault(); state.player.next(); scrollCurrent('smooth'); }
    return;
  }
  if (event.key.toLowerCase() === 'l' && state.view === 'note') { event.preventDefault(); toggleLoop(); return; }
  if (event.key.toLowerCase() === 'f' && state.view === 'note') { event.preventDefault(); toggleFocus(); return; }
  if (event.key === '?') { event.preventDefault(); openSettings(); return; }
  if (event.key === 'Escape') {
    closeSidebar();
    exitFocus();
  }
}

/* ---------- player events ---------- */
function attachPlayerEvents() {
  const player = state.player;
  player.on('sentence', (snapshot) => {
    if (!state.note || state.view !== 'note') return;
    savePositionSoon(snapshot.index);
    syncPlayerUI(snapshot);
  });
  player.on('state', (snapshot) => {
    if (snapshot.playing && !snapshot.paused) requestWakeLock();
    else releaseWakeLock();
    if (snapshot.paused) flushPosition();
    syncPlayerUI(snapshot);
  });
  player.on('finish', () => {
    releaseWakeLock();
    if (!state.note) return;
    state.note.position = 0;
    flushPosition();
    syncPlayerUI(player.snapshot());
    if (!state.finishedToastOpen) {
      state.finishedToastOpen = true;
      toast('Finished this note. Want to hear it again?', {
        duration: 6000,
        action: {
          label: 'Replay',
          onClick: () => {
            state.player.seek(0);
            state.player.play();
            state.finishedToastOpen = false;
          }
        }
      });
    }
  });
  player.on('error', (event) => {
    const message = event?.message || 'Could not play audio.';
    const voiceIssue = /voice|speech|text-to-speech/i.test(message);
    toast(message, {
      duration: voiceIssue ? 9000 : 4200,
      action: voiceIssue
        ? { label: 'Voice settings', onClick: () => openSettings('voice-section') }
        : undefined
    });
  });
}

/* ---------- theme, online, service worker ---------- */
function setupThemeWatcher() {
  state.systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (state.settings.theme === 'system') applyTheme('system');
  };
  try { state.systemThemeMedia.addEventListener('change', onChange); }
  catch (error) { state.systemThemeMedia.addListener?.(onChange); }
}

let wasOffline = false;
function updateOnlineStatus() {
  const offline = !navigator.onLine;
  if (!offline && wasOffline) toast('Back online.');
  wasOffline = offline;
  els.offlineBanner.hidden = !offline;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL('sw.js', location.href), { scope: './' });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version of Shruti is ready.', {
              duration: 12000,
              action: { label: 'Refresh', onClick: () => location.reload() }
            });
          }
        });
      });
    } catch (error) {
      // The app still works without offline caching.
    }
  });
}

/* ---------- boot ---------- */
function init() {
  if (!store.storageAvailable() && !state.storageWarned) {
    state.storageWarned = true;
    toast('Private storage is blocked in this browser. You can listen, but notes may not save.', { duration: 10000 });
  }

  applyTheme(state.settings.theme);
  applyFontSize(state.settings.fontSize);
  applyRate(state.settings.rate);
  els.autoscrollToggle.checked = Boolean(state.settings.autoScroll);
  els.wakelockToggle.checked = Boolean(state.settings.keepAwake);
  setupThemeWatcher();
  attachPlayerEvents();
  setupMediaSession();
  bindEvents();
  renderLibrary();
  refreshVoices();

  const lastId = state.settings.lastNoteId;
  const initial = state.index.find((item) => item.id === lastId)?.id || state.index[0]?.id;
  if (initial) openNote(initial);
  else showComposer();

  updateOnlineStatus();
  updateSleepUI();
  registerServiceWorker();

  if (!isSupported()) {
    setTimeout(() => toast('This browser cannot speak yet. Try Chrome, Edge, Safari or Firefox with a voice installed.', { duration: 9000 }), 900);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
