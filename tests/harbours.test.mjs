import assert from 'node:assert/strict';
import test from 'node:test';
import {peakIndex} from '../web/harbours.mjs';

test('station peaks preserve unavailable periods, negative readings and the first tied peak', () => {
  assert.equal(peakIndex([null, null]), -1);
  assert.equal(peakIndex([null, -0.4, -0.2, null]), 2);
  assert.equal(peakIndex([null, 0, 0]), 1);
});
