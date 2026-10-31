import test from 'node:test';
import assert from 'node:assert/strict';

const spoken = [];
const synth = {
  paused: false,
  current: null,
  getVoices() {
    return [{ name: 'Hindi', lang: 'hi-IN', voiceURI: 'hi-in', localService: true }];
  },
  addEventListener() {},
  removeEventListener() {},
  speak(utterance) {
    this.current = utterance;
    spoken.push(utterance);
    if (typeof utterance.onstart === 'function') utterance.onstart();
  },
  cancel() {
    this.current = null;
    this.paused = false;
  },
  pause() { this.paused = true; },
  resume() { this.paused = false; }
};

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
globalThis.SpeechSynthesisUtterance = FakeUtterance;

const { SpeechPlayer } = await import('../js/speech.js');

function endCurrent() {
  const utterance = synth.current;
  assert.ok(utterance, 'expected the player to be speaking');
  synth.current = null;
  utterance.onend();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('speaks sentences in order and emits finish', async () => {
  spoken.length = 0;
  const player = new SpeechPlayer();
  const states = [];
  player.on('state', (snapshot) => states.push(snapshot));
  player.load([{ text: 'First sentence.' }, { text: 'Second sentence.' }]);
  player.play();

  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'First sentence.');
  endCurrent();

  await wait(180);
  assert.equal(player.index, 1);
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].text, 'Second sentence.');

  endCurrent();
  assert.equal(player.finished, true);
  assert.equal(player.playing, false);
  assert.equal(states.at(-1).finished, true);
});

test('pauses and resumes the current utterance', () => {
  spoken.length = 0;
  const player = new SpeechPlayer();
  player.load(['Only sentence.']);
  player.play();
  player.pause();

  assert.equal(player.playing, true);
  assert.equal(player.paused, true);
  assert.equal(synth.paused, true);

  player.resume();
  assert.equal(player.paused, false);
  assert.equal(synth.paused, false);
  assert.equal(spoken.length, 1);
});

test('reports a helpful error when the device has no usable voice', () => {
  const player = new SpeechPlayer();
  const errors = [];
  player.on('error', (event) => errors.push(event));
  player.load(['A sentence.']);
  player.play();

  synth.current.onerror({ error: 'synthesis-failed' });
  assert.equal(player.playing, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Install an English or Hindi voice/);
});
