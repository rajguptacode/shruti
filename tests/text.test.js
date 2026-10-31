import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNote, splitSentences, detectLanguage, cleanInline,
  extractTitle, previewText, estimateSentenceMinutes, countWords,
  stripLeadingTitle
} from '../js/text.js';

test('detects English, Hindi and Hinglish', () => {
  assert.equal(detectLanguage('Photosynthesis is the process by which plants make food.'), 'en');
  assert.equal(detectLanguage('प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे भोजन बनाते हैं।'), 'hi');
  assert.equal(detectLanguage('Aaj hum federalism padhenge. Yeh chapter important hai. Exam mein yaad rakhna.'), 'hinglish');
});

test('splits Hindi and English sentences', () => {
  assert.deepEqual(splitSentences('पहला वाक्य। दूसरा वाक्य! तीसरा?'), ['पहला वाक्य।', 'दूसरा वाक्य!', 'तीसरा?']);
  assert.deepEqual(splitSentences('One thing. Two things! Three?'), ['One thing.', 'Two things!', 'Three?']);
});

test('keeps initials and abbreviations together', () => {
  const result = splitSentences('Dr. A. P. J. Abdul Kalam was born in 1931. He was the 11th President.');
  assert.deepEqual(result, ['Dr. A. P. J. Abdul Kalam was born in 1931.', 'He was the 11th President.']);
});

test('cleans markdown and skips separators', () => {
  const text = '# Heading\n\n**Bold** and [a link](https://example.com) and `code`.\n\n---\n\n- First point\n- Second point';
  const parsed = parseNote(text);
  assert.equal(parsed.blocks[0].type, 'h');
  assert.equal(parsed.blocks[0].sentences[0].text, 'Heading');
  assert.equal(parsed.blocks[1].sentences[0].text, 'Bold and a link and code.');
  assert.equal(parsed.blocks[2].type, 'li');
  assert.equal(parsed.blocks[2].marker, '•');
  assert.equal(parsed.blocks[2].sentences[0].text, 'First point');
  assert.equal(cleanInline('Read this 🙂 https://example.com'), 'Read this');
});

test('turns table rows into speakable blocks', () => {
  const parsed = parseNote('| Term | Meaning |\n|---|---|\n| Chlorophyll | Green pigment |');
  assert.equal(parsed.blocks.length, 2);
  assert.equal(parsed.blocks[0].type, 'table');
  assert.equal(parsed.blocks[1].sentences[0].text, 'Chlorophyll · Green pigment');
});

test('preserves global sentence indices across blocks', () => {
  const parsed = parseNote('# One\n\nFirst sentence. Second sentence.\n\n- Third sentence.');
  assert.deepEqual(parsed.sentences.map((item) => item.index), [0, 1, 2, 3]);
  assert.equal(parsed.sentences[3].text, 'Third sentence.');
});

test('extracts a useful title', () => {
  assert.equal(extractTitle('# Photosynthesis\n\nDetails here.'), 'Photosynthesis');
  assert.equal(extractTitle('   \n\n'), 'Untitled note');
  assert.equal(extractTitle('- A bullet title\nrest'), 'A bullet title');
  assert.ok(extractTitle('A '.repeat(80)).length <= 82);
});

test('removes the leading title without emptying the note', () => {
  assert.equal(stripLeadingTitle('# Photosynthesis\n\nDetails here.'), 'Details here.');
  assert.equal(stripLeadingTitle('\n\n## Chapter 1\nFirst point.'), 'First point.');
  assert.equal(stripLeadingTitle('Photosynthesis\n\nDetails here.'), 'Details here.');
  assert.equal(stripLeadingTitle('**Photosynthesis**\n\nDetails here.'), 'Details here.');
  assert.equal(stripLeadingTitle('# Only a heading'), '# Only a heading');
  assert.equal(stripLeadingTitle('Photosynthesis is important.\n\nMore details.'), 'Photosynthesis is important.\n\nMore details.');
  assert.equal(stripLeadingTitle('Title\nNo blank line.'), 'Title\nNo blank line.');
  assert.equal(stripLeadingTitle('- A bullet\n\nBody text.'), '- A bullet\n\nBody text.');
});

test('builds a short preview', () => {
  const preview = previewText('First sentence. Second sentence. Third sentence.', 25);
  assert.ok(preview.length <= 25);
  assert.ok(preview.endsWith('…'));
});

test('estimates listening time', () => {
  const parsed = parseNote('One two three four five. Six seven eight nine ten.');
  assert.equal(countWords('one two three'), 3);
  assert.equal(estimateSentenceMinutes(parsed.sentences), 1);
});

test('long sentences are split into TTS-sized pieces', () => {
  const long = `${'word '.repeat(90)}ends here.`;
  const parts = splitSentences(long);
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(part.length <= 242);
});
