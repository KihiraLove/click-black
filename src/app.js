import { TileGame, GRID_SIZE, TAPS_PER_ROUND } from './game.js';
import { cleanScores, readScores, writeScores } from './scores.js';

const $ = id => document.getElementById(id);
const game = new TileGame();
const tapNotes = [523.25, 587.33, 659.25, 783.99, 880, 987.77];
let storage;
try { storage = window.localStorage; } catch { /* Private browsing can deny storage. */ }
let scores = readScores(storage);
let screen = 'home';
let frame = 0;
let soundOn = false;
let lastTapPitch;
let volume = Number($('volume').value) / 100;
let audioContext;
let masterGain;
let latestId;
let scoreFlash;
let bonusTimer;
const timers = new Set();
const tileTimers = new Map();

function later(callback, delay) {
  const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
  timers.add(timer);
  return timer;
}

function clearTimers() {
  cancelAnimationFrame(frame);
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  tileTimers.clear();
}

function tone(frequency, duration = .06, type = 'sine', amplitude = .045) {
  if (!soundOn || volume === 0) return;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioContext.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(amplitude, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Audio is optional; gameplay always works without it. */ }
}

const tiles = Array.from({ length: GRID_SIZE }, (_, index) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.tabIndex = -1;
  tile.className = 'tile';
  tile.dataset.index = index;
  tile.addEventListener('pointerdown', event => {
    if (event.button !== 0 || screen !== 'playing') return;
    event.preventDefault();
    tap(index);
  });
  $('board').append(tile);
  return tile;
});
$('board').tabIndex = -1;

function tileLabel(index, black) {
  return `${black ? 'Black' : 'White'} tile, row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}`;
}

function resetBoard() {
  $('board').classList.remove('overdrive');
  $('overdrive').hidden = true;
  tiles.forEach((tile, index) => {
    tile.className = 'tile';
    tile.setAttribute('aria-label', tileLabel(index, false));
    tile.disabled = true;
  });
}

function setBlack(index, animate = false) {
  clearTimeout(tileTimers.get(index));
  const tile = tiles[index];
  tile.className = `tile black${animate ? ' spawn' : ''}`;
  tile.setAttribute('aria-label', tileLabel(index, true));
}

function updateHud() {
  const overdrive = game.overdriveUntil > 0;
  if ($('board').classList.contains('overdrive') !== overdrive) {
    $('board').classList.toggle('overdrive', overdrive);
    $('overdrive').hidden = !overdrive;
    if (overdrive) $('hint').hidden = true;
    tiles.forEach((tile, index) => {
      tile.disabled = overdrive;
      tile.setAttribute('aria-label', tileLabel(index, overdrive || game.black.has(index)));
    });
  }
  $('score').textContent = game.score;
  const seconds = Math.ceil(game.remaining / 1000);
  $('time').textContent = String(seconds).padStart(2, '0');
  $('time').classList.toggle('urgent', seconds <= 5);
  const progress = game.score % TAPS_PER_ROUND;
  $('progress-fill').style.width = `${progress / TAPS_PER_ROUND * 100}%`;
  $('progress').setAttribute('aria-valuenow', progress);
  $('progress-caption').textContent = `${TAPS_PER_ROUND - progress} taps to +10 seconds`;
  $('progress-caption').hidden = false;
}

function showHome() {
  clearTimers();
  game.status = 'idle';
  screen = 'home';
  $('play-screen').hidden = false;
  $('results-screen').hidden = true;
  $('home').hidden = false;
  $('countdown-overlay').hidden = true;
  $('end-overlay').hidden = true;
  $('hint').hidden = true;
  $('bonus').hidden = true;
  $('help').disabled = false;
  $('best').textContent = scores[0]?.score ?? 0;
  $('score').textContent = '0';
  $('score').classList.remove('hit');
  $('time').textContent = '10';
  $('time').classList.remove('urgent');
  $('progress-fill').style.width = '0%';
  $('progress').setAttribute('aria-valuenow', '0');
  $('progress-caption').textContent = '';
  $('progress-caption').hidden = true;
  resetBoard();
  $('start').focus({ preventScroll: true });
}

function startCountdown() {
  if (screen === 'countdown' || screen === 'playing' || screen === 'ending') return;
  clearTimers();
  screen = 'countdown';
  $('play-screen').hidden = false;
  $('results-screen').hidden = true;
  $('home').hidden = true;
  $('end-overlay').hidden = true;
  $('bonus').hidden = true;
  $('hint').hidden = true;
  $('countdown-overlay').hidden = false;
  $('score').textContent = '0';
  $('score').classList.remove('hit');
  $('time').textContent = '10';
  $('time').classList.remove('urgent');
  $('best').textContent = scores[0]?.score ?? 0;
  $('progress-fill').style.width = '0%';
  $('progress').setAttribute('aria-valuenow', '0');
  $('progress-caption').textContent = '';
  $('progress-caption').hidden = true;
  $('help').disabled = true;
  resetBoard();
  let count = 3;
  $('countdown').textContent = count;
  tone(440, .08);
  function next() {
    count -= 1;
    if (count === 0) { begin(); return; }
    $('countdown').textContent = count;
    tone(440, .08);
    later(next, 1000);
  }
  later(next, 1000);
}

function begin() {
  game.start(performance.now());
  screen = 'playing';
  $('countdown-overlay').hidden = true;
  $('hint').hidden = false;
  tiles.forEach(tile => { tile.disabled = false; });
  game.black.forEach(index => setBlack(index));
  $('board').focus({ preventScroll: true });
  $('announcement').textContent = 'Go! Tap the black tiles.';
  tone(880, .12);
  later(() => { $('hint').hidden = true; }, 1800);
  updateHud();
  frame = requestAnimationFrame(tick);
}

function tick(now) {
  if (screen !== 'playing') return;
  game.tick(now);
  updateHud();
  if (game.status === 'over') finish();
  else frame = requestAnimationFrame(tick);
}

function tap(index) {
  if (screen !== 'playing') return;
  const result = game.tap(index, performance.now());
  updateHud();
  if (result.type === 'over') {
    if (result.reason === 'white') {
      clearTimeout(tileTimers.get(index));
      tiles[index].className = 'tile wrong';
    }
    finish();
    return;
  }
  if (result.type !== 'hit') return;
  clearTimeout(tileTimers.get(index));
  tiles[index].className = 'tile correct';
  tiles[index].setAttribute('aria-label', tileLabel(index, result.overdrive));
  tileTimers.set(index, later(() => {
    tiles[index].classList.remove('correct');
    tileTimers.delete(index);
  }, 460));
  setBlack(result.replacement, true);
  $('score').classList.add('hit');
  clearTimeout(scoreFlash);
  scoreFlash = later(() => $('score').classList.remove('hit'), 160);
  const notes = tapNotes.filter(note => note !== lastTapPitch);
  lastTapPitch = notes[Math.floor(Math.random() * notes.length)];
  tone(lastTapPitch);
  if (result.bonus) {
    clearTimeout(bonusTimer);
    $('bonus').hidden = result.overdrive;
    if (!result.overdrive) bonusTimer = later(() => { $('bonus').hidden = true; }, 950);
    $('announcement').textContent = result.overdrive
      ? `Overdrive! ${game.score} tiles. Ten extra seconds!`
      : `${game.score} tiles. Ten extra seconds!`;
    tone(1046.5, .2);
  }
}

function finish() {
  if (screen !== 'playing') return;
  screen = 'ending';
  cancelAnimationFrame(frame);
  $('hint').hidden = true;
  $('bonus').hidden = true;
  $('score').classList.remove('hit');
  $('end-overlay').hidden = false;
  const message = game.reason === 'white' ? 'You tapped a white tile!' : "Time’s up!";
  $('end-reason').textContent = message;
  $('announcement').textContent = `${message} You scored ${game.score}.`;
  tiles.forEach(tile => { tile.disabled = true; });
  tone(140, .25, 'triangle', .07);
  const previousBest = scores[0]?.score ?? 0;
  latestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Re-read to preserve scores recorded in another tab.
  scores = cleanScores([...scores, ...readScores(storage)]
    .filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id) === index)
    .concat({ score: game.score, date: new Date().toISOString(), id: latestId }));
  writeScores(storage, scores);
  later(() => showResults(game.score, game.reason === 'white' ? '' : message, game.score > previousBest), 1100);
}

function showResults(score = null, message = 'Your personal bests, all in one place.', record = false) {
  clearTimers();
  screen = 'results';
  $('play-screen').hidden = true;
  $('results-screen').hidden = false;
  $('help').disabled = false;
  $('results-title').replaceChildren();
  if (score === null) $('results-title').textContent = 'High scores';
  else {
    $('results-title').append('You scored ');
    const number = document.createElement('span');
    number.id = 'result-score';
    number.textContent = score;
    $('results-title').append(number);
  }
  $('result-message').textContent = message;
  $('result-message').hidden = !message;
  $('record-message').hidden = !record;
  $('scores-list').replaceChildren();
  const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
  for (const entry of scores) {
    const row = document.createElement('tr');
    if (entry.id === latestId && score !== null) row.className = 'current';
    const date = document.createElement('td');
    date.textContent = formatter.format(new Date(entry.date));
    const value = document.createElement('td');
    value.textContent = entry.score;
    row.append(date, value);
    $('scores-list').append(row);
  }
  $('empty-scores').hidden = scores.length > 0;
  $('retry').focus({ preventScroll: true });
}

$('start').addEventListener('click', startCountdown);
$('retry').addEventListener('click', startCountdown);
$('menu').addEventListener('click', showHome);
$('view-scores').addEventListener('click', () => showResults());
$('sound').addEventListener('click', () => {
  soundOn = !soundOn;
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').setAttribute('aria-label', `Turn sound ${soundOn ? 'off' : 'on'}`);
  $('sound-label').textContent = `Sound ${soundOn ? 'on' : 'off'}`;
  $('sound-waves').setAttribute('d', soundOn ? 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm16 9 6 6m0-6-6 6');
  tone(660, .1);
});
$('volume').addEventListener('input', () => {
  volume = Number($('volume').value) / 100;
  $('volume').setAttribute('aria-valuetext', `${$('volume').value}%`);
  if (masterGain) masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, .01);
});
$('help').addEventListener('click', () => $('help-dialog').showModal());
$('close-help').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => {
  if (event.target !== $('help-dialog')) return;
  const box = $('help-dialog').getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('help-dialog').close();
});
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { $('announcement').textContent = 'Fullscreen is unavailable in this browser.'; }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-label', `${document.fullscreenElement ? 'Exit' : 'Enter'} fullscreen`);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'countdown') showHome();
  // A background tab never grants free time. Recheck the deadline on return.
  if (!document.hidden && screen === 'playing') {
    game.tick(performance.now());
    updateHud();
    if (game.status === 'over') finish();
  }
});

showHome();
