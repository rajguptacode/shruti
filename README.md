# Shruti

**Paste your notes. Hear them. Remember more.**

Shruti is a free, private, browser-based study app for Class 10 revision. Paste text from an AI tutor, textbook or your own notes, and it reads them aloud sentence by sentence in **English, Hindi or Hinglish**.

No account. No API key. No server. Everything runs in your browser and your notes stay on your device.

- **Live app:** <https://rajguptacode.github.io/shruti/>
- **Stack:** plain HTML, CSS and JavaScript — no build step
- **Speech:** the browser's built-in Web Speech API
- **Storage:** `localStorage` on your device

---

## Why Shruti?

Reading long AI answers can feel like work. Listening is easier to fit into a walk, a bus ride or a revision break.

Shruti turns any text into a small listening session:

- Splits notes into sentences and highlights the sentence being read.
- Tap any sentence to start from there.
- Repeat one sentence when something is hard to remember.
- Adjust speed, text size and sleep timer.
- Works as an installable app and keeps working offline after the first visit.

## Features

| Feature | What it does |
| --- | --- |
| Auto language detection | Recognises English, Hindi (Devanagari) and Hinglish. You can override it. |
| Sentence focus | Highlights the current sentence and keeps it in view. |
| Click to seek | Tap a sentence to listen from that point. |
| Loop sentence | Repeats the current sentence for memorisation. |
| Sleep timer | Pauses playback after 5–45 minutes. |
| Library | Saves notes locally with search, edit and delete. |
| Backup / import | Exports all notes as a JSON file you own. |
| Themes | Light, dark or follow the system. |
| PWA | Install to your home screen; app shell is cached for offline use. |
| Wake Lock | Asks the browser to keep the screen awake while audio plays. |

## Getting started

### Use the published app

Open the GitHub Pages link on your phone or laptop. That is all a student needs.

### Run it locally

```bash
cd shruti
python3 -m http.server 8080
```

Open <http://localhost:8080/>.

You can also use `npm start`, which runs the same command. There is no install step and no build step.

### Run the tests

```bash
npm test
```

The tests use Node's built-in test runner and do not need any dependencies.

## Publish to GitHub Pages

### Option A — from the GitHub website

1. Create a new **public** repository named `shruti`.
2. Upload every file in this folder, keeping the folder structure.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/ (root)**, then click **Save**.
6. Wait a minute. Your link will be:

   ```text
   https://YOUR-USERNAME.github.io/shruti/
   ```

The included `.nojekyll` file stops GitHub from running Jekyll on the site. Relative paths mean the app works from a repository subpath without configuration.

### Option B — with git

```bash
cd shruti
git init
git add .
git commit -m "Add Shruti audio study notes"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shruti.git
git push -u origin main
```

Then enable Pages as described above.

### Updating a published copy

When you change app files, bump `VERSION` in `sw.js` (for example `shruti-v1.0.1`). This makes the service worker replace the old offline cache, so phones pick up the new version instead of an old cached one.

## Add voices to your device

Shruti uses the voices already installed on your phone, tablet or computer. The browser cannot download a voice by itself.

If you hear the default voice reading Hindi badly, install a Hindi voice:

- **Android:** Settings → System → Languages & input → Text-to-speech output → Google TTS → Install voice data → **हिंदी**.
- **Windows:** Settings → Time & Language → Language & region → Add a language → **हिंदी** → install the speech pack. Reload the page.
- **iPhone / iPad:** Settings → Accessibility → Spoken Content → Voices → **Hindi**.
- **Mac:** System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → **Hindi**.
- **ChromeOS / Linux:** install a speech-dispatcher voice such as `espeak-ng` and a Hindi voice pack, or use a browser/device that already has Hindi TTS.

In the app, open **Settings → Voice** to see what is available, test a voice, or pick one manually. **Automatic** is usually best: it picks the closest installed voice for each note's language.

### Suggested voices

- **English:** any natural `en-IN` voice if available, otherwise `en-GB` or `en-US`.
- **Hindi:** a local `hi-IN` voice.
- **Hinglish:** `en-IN` usually sounds best because the note is mostly English with Hindi words. If your device mixes Hindi words poorly, try a `hi-IN` voice manually.

## Privacy

Shruti is deliberately boring about data:

- Notes, drafts and settings are stored in your browser's `localStorage`.
- Notes are **not** uploaded to a server, an account or an AI service.
- There is no analytics, tracking, advertising or sign-in.
- Backups are generated in the browser and downloaded directly to your device.
- The browser's speech engine runs locally for installed voices. Some system "online" voices may use the network — the voice list marks those with **· online**.

Clearing browser data, using private mode, or changing browser/device can remove your notes. Export a backup before clearing site data.

## Limitations

- **Voice quality varies by device.** Shruti does not ship its own voices. A ₹8,000 phone and a laptop will sound different.
- **Speech synthesis is not an audio file.** You cannot download an MP3; playback is generated live by the browser.
- **Screen lock may pause speech on some phones.** Shruti requests a Wake Lock and uses Media Session controls, but mobile operating systems can still suspend background speech. Keep the screen on for long sessions, or listen with the screen awake.
- **No word-level highlighting.** Highlighting is per sentence.
- **Language detection is a heuristic.** It works well for normal study notes but can be wrong on very short text. Use the language buttons to override.
- **Storage is per browser and per site.** Notes do not sync between devices. Use **Backup → Import** to move them.
- **Private mode may block storage.** The app still lets you listen, but notes may disappear when you close the tab.
- **GitHub Pages is a static host.** That is intentional: there is no backend to maintain or pay for.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Previous / next sentence |
| `L` | Repeat current sentence |
| `F` | Focus mode |
| `?` | Open settings |
| `Ctrl/Cmd + Enter` | Start listening from the composer |

## Project structure

```text
shruti/
├── index.html               # App shell, dialogs and icons
├── styles.css               # Warm-paper design, light/dark themes, responsive layout
├── js/
│   ├── app.js               # UI, player wiring, library, settings, backup
│   ├── text.js              # Markdown cleanup, sentence splitting, language detection
│   ├── store.js             # localStorage notes, index, settings, drafts
│   └── speech.js            # Web Speech API wrapper and voice ranking
├── tests/                   # Node test runner tests
├── assets/                  # Icons and social preview image
├── scripts/make-icons.py    # Regenerates PNG icons from the SVG source
├── manifest.webmanifest     # PWA metadata
├── sw.js                    # Offline app-shell caching
├── .nojekyll                # GitHub Pages: skip Jekyll
└── package.json
```

## How it works

1. Pasted text is normalised, cleaned of markdown noise and split into sentences. A leading markdown heading or standalone title line becomes the note title and is removed from the reading body.
2. Sentences are rendered as clickable spans and fed to a small `SpeechPlayer` wrapper.
3. The player speaks one sentence at a time with `speechSynthesis`, then advances. It handles pause/resume, seeking, looping, rate changes and browser quirks.
4. Notes and settings are written to `localStorage` under the `shruti.v1.*` prefix.
5. A service worker caches the app shell so the interface opens offline. Speech still depends on locally installed voices.

## Design

Warm paper, deep green and marigold. Literata for reading, DM Sans for the interface, Noto Serif Devanagari for Hindi text and Noto Sans Devanagari for Hindi UI labels.

## License

MIT. See [LICENSE](LICENSE).

Made for focused revision. No streak counters, no notifications, no guilt.
