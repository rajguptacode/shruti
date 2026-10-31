import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseAutoVoice, dedupeVoices, sortVoicesForUI, voiceMatchesLang, findVoice
} from '../js/speech.js';

const voices = [
  { name: 'Hindi', lang: 'hi-IN', voiceURI: 'hi-in', localService: true },
  { name: 'English India', lang: 'en-IN', voiceURI: 'en-in', localService: true },
  { name: 'English US', lang: 'en_US', voiceURI: 'en-us', localService: false }
];

test('chooses an Indian voice for each note language', () => {
  assert.equal(chooseAutoVoice(voices, 'hi').voiceURI, 'hi-in');
  assert.equal(chooseAutoVoice(voices, 'hinglish').voiceURI, 'en-in');
  assert.equal(chooseAutoVoice(voices, 'en').voiceURI, 'en-in');
});

test('falls back to the first installed voice when nothing matches', () => {
  const rare = [{ name: 'Japanese', lang: 'ja-JP', voiceURI: 'ja' }];
  assert.equal(chooseAutoVoice(rare, 'hi').voiceURI, 'ja');
});

test('dedupes and sorts voices with Indian languages first', () => {
  const sorted = sortVoicesForUI([...voices, voices[0]]);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].lang, 'hi-IN');
  assert.equal(sorted[1].lang, 'en-IN');
});

test('matches voices to note languages', () => {
  assert.equal(voiceMatchesLang(voices[0], 'hi'), true);
  assert.equal(voiceMatchesLang(voices[0], 'en'), false);
  assert.equal(voiceMatchesLang(voices[1], 'hinglish'), true);
  assert.equal(findVoice(voices, 'en-in').name, 'English India');
});
