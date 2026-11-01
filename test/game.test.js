import test from 'node:test';
import assert from 'node:assert/strict';
import { TileGame, BLACK_TILES, ROUND_MS, OVERDRIVE_MS } from '../src/game.js';
import { cleanScores, readScores, writeScores, STORAGE_KEY } from '../src/scores.js';

test('a run starts with three distinct black tiles and ten seconds', () => {
  const game = new TileGame(() => .5);
  game.start(100);
  assert.equal(game.black.size, BLACK_TILES);
  assert.equal(game.deadline, 10_100);
  assert.equal(game.score, 0);
  assert.equal(game.status, 'playing');
});

test('a hit turns white and spawns a different black tile, preserving three targets', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  const result = game.tap(0, 400);
  assert.equal(result.type, 'hit');
  assert.equal(game.score, 1);
  assert.equal(game.black.has(0), false);
  assert.equal(game.black.size, BLACK_TILES);
  assert.notEqual(result.replacement, 0);
  assert.equal(game.remaining, 9600);
});

test('each block of 40 taps grants ten seconds while keeping time already remaining', () => {
  const game = new TileGame(() => .5);
  game.start(0);
  let now = 0;
  let pauses = 0;
  for (let index = 1; index <= 120; index++) {
    now += 90;
    const result = game.tap([...game.black][0], now);
    assert.equal(result.bonus, index % 40 === 0);
    if (result.overdrive) { pauses += OVERDRIVE_MS; now += OVERDRIVE_MS; }
    assert.equal(game.deadline, ROUND_MS * (1 + Math.floor(index / 40)) + pauses);
    assert.equal(game.black.size, 3);
  }
  assert.equal(game.score, 120);
  assert.equal(game.status, 'playing');
});

function completeSet(game, start, duration) {
  let result;
  for (let tap = 1; tap <= 40; tap++) {
    result = game.tap([...game.black][0], start + duration * tap / 40);
    assert.equal(result.type, 'hit');
  }
  return result;
}

test('Overdrive uses the current even set duration, including the eight-second boundary', () => {
  for (const [duration, expected] of [[7999, true], [8000, true], [8001, false]]) {
    const game = new TileGame(() => 0);
    game.start(100);
    assert.equal(completeSet(game, 100, 9000).overdrive, false);
    assert.equal(completeSet(game, 9100, duration).overdrive, expected);
    assert.equal(game.score, 80);
  }
});

test('only sets 2, 4, 6, and so on can trigger Overdrive', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  let now = 0;
  for (let set = 1; set <= 6; set++) {
    const result = completeSet(game, now, 4000);
    assert.equal(result.overdrive, set % 2 === 0);
    now += 4000 + (result.overdrive ? OVERDRIVE_MS : 0);
  }
  assert.equal(game.score, 240);
});

test('a slow even set is skipped and the next eligible set can still trigger', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  completeSet(game, 0, 4000);
  assert.equal(completeSet(game, 4000, 8001).overdrive, false);
  assert.equal(completeSet(game, 12001, 4000).overdrive, false);
  assert.equal(completeSet(game, 16001, 8000).overdrive, true);
});

test('Overdrive pauses input and the timer for one second, then resumes normal rules', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  completeSet(game, 0, 4000);
  completeSet(game, 4000, 4000);
  const remaining = game.remaining;
  const white = Array.from({ length: 16 }, (_, i) => i).find(i => !game.black.has(i));
  assert.equal(game.tap(white, 8200).type, 'ignored');
  assert.equal(game.tap([...game.black][0], 8500).type, 'ignored');
  assert.equal(game.score, 80);
  assert.equal(game.remaining, remaining);
  game.tick(9000);
  assert.equal(game.overdriveUntil, 0);
  assert.equal(game.remaining, remaining);
  assert.equal(game.black.size, 3);
  assert.equal(game.tap([...game.black][0], 9001).type, 'hit');
  const nextWhite = Array.from({ length: 16 }, (_, i) => i).find(i => !game.black.has(i));
  assert.equal(game.tap(nextWhite, 9002).reason, 'white');
});

test('restart clears the Overdrive phase and starts the first set from the new start time', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  completeSet(game, 0, 4000);
  completeSet(game, 4000, 4000);
  assert.ok(game.overdriveUntil > 0);
  game.start(8500);
  assert.equal(game.overdriveUntil, 0);
  assert.equal(game.setStartedAt, 8500);
  assert.equal(game.score, 0);
  assert.equal(completeSet(game, 8500, 4000).overdrive, false);
});

test('tapping white ends the run and subsequent input cannot change the score', () => {
  const game = new TileGame(() => 0);
  game.start(0);
  assert.equal(game.tap(15, 100).reason, 'white');
  assert.equal(game.status, 'over');
  assert.equal(game.tap(0, 110).type, 'ignored');
  assert.equal(game.score, 0);
});

test('a tap at or beyond the deadline cannot rescue an expired run', () => {
  for (const now of [10_000, 15_000]) {
    const game = new TileGame(() => 0);
    game.start(0);
    assert.equal(game.tap(0, now).reason, 'timeout');
    assert.equal(game.score, 0);
    assert.equal(game.remaining, 0);
  }
});

test('the timer uses elapsed time, including time in a background tab', () => {
  const game = new TileGame();
  game.start(500);
  game.tick(8500);
  assert.equal(game.remaining, 2000);
  game.tick(60_000);
  assert.equal(game.status, 'over');
  assert.equal(game.reason, 'timeout');
});

test('restart resets all run state and malformed input is ignored', () => {
  const game = new TileGame(() => 0);
  assert.equal(game.tap(0, 0).type, 'ignored');
  game.start(0);
  for (const index of [-1, 16, NaN, 1.5, '0']) assert.equal(game.tap(index, 100).type, 'ignored');
  game.tap(0, 100);
  game.tap(15, 200);
  game.start(5000);
  assert.equal(game.score, 0);
  assert.equal(game.reason, null);
  assert.equal(game.deadline, 15_000);
  assert.equal(game.black.size, 3);
});

test('scores are validated, sorted, and limited to the best eight runs', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ score: i * 10, date: '2026-11-01T12:00:00.000Z', id: String(i) }));
  entries.push(null, { score: '900', date: 'bad' }, { score: -5, date: '2026-11-01', id: 'bad' });
  const scores = cleanScores(entries);
  assert.equal(scores.length, 8);
  assert.equal(scores[0].score, 110);
  assert.equal(scores.at(-1).score, 40);
});

test('scores survive reload; unavailable or corrupt storage is tolerated', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const entries = [{ score: 12, date: '2026-11-01', id: 'first' }];
  assert.equal(writeScores(storage, entries), true);
  assert.deepEqual(readScores(storage), entries);
  data.set(STORAGE_KEY, '{broken');
  assert.deepEqual(readScores(storage), []);
  assert.deepEqual(readScores(undefined), []);
  assert.equal(writeScores(undefined, entries), false);
});
