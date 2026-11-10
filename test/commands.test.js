import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessageText, parseCommand } from '../src/commands.js';

test('parses command names and arguments', () => {
  assert.deepEqual(parseCommand('.PP al physics 2022', '.'), {
    name: 'pp',
    args: ['al', 'physics', '2022'],
  });
});

test('ignores regular messages and empty commands', () => {
  assert.equal(parseCommand('hello', '.'), null);
  assert.equal(parseCommand('.', '.'), null);
});

test('does not unwrap view-once wrappers', () => {
  assert.equal(getMessageText({ viewOnceMessage: { message: { imageMessage: { caption: '.help' } } } }), '');
});
