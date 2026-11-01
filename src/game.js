export const GRID_SIZE = 16;
export const BLACK_TILES = 3;
export const ROUND_MS = 10_000;
export const TAPS_PER_ROUND = 40;

/** Pure game rules; callers supply a monotonic timestamp in milliseconds. */
export class TileGame {
  constructor(random = Math.random) {
    this.random = random;
    this.status = 'idle';
    this.score = 0;
    this.black = new Set();
    this.deadline = 0;
    this.remaining = ROUND_MS;
    this.reason = null;
  }

  start(now) {
    this.status = 'playing';
    this.score = 0;
    this.deadline = now + ROUND_MS;
    this.remaining = ROUND_MS;
    this.reason = null;
    this.black.clear();
    while (this.black.size < BLACK_TILES) this.addTile();
  }

  addTile(exclude = -1) {
    const available = Array.from({ length: GRID_SIZE }, (_, index) => index)
      .filter(index => index !== exclude && !this.black.has(index));
    const index = available[Math.min(available.length - 1, Math.floor(this.random() * available.length))];
    this.black.add(index);
    return index;
  }

  tick(now) {
    if (this.status !== 'playing') return;
    this.remaining = Math.max(0, this.deadline - now);
    if (this.remaining === 0) this.end('timeout');
  }

  tap(index, now) {
    if (this.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= GRID_SIZE) {
      return { type: 'ignored' };
    }
    this.tick(now);
    if (this.status !== 'playing') return { type: 'over', reason: this.reason };
    if (!this.black.has(index)) {
      this.end('white');
      return { type: 'over', reason: this.reason, index };
    }
    this.black.delete(index);
    const replacement = this.addTile(index);
    this.score += 1;
    const bonus = this.score % TAPS_PER_ROUND === 0;
    if (bonus) {
      this.deadline += ROUND_MS;
      this.remaining = this.deadline - now;
    }
    return { type: 'hit', index, replacement, bonus };
  }

  end(reason) {
    if (this.status !== 'playing') return;
    this.status = 'over';
    this.reason = reason;
  }
}
