export const STORAGE_KEY = 'white-tile-2.scores.v1';
export const MAX_SCORES = 8;

export function cleanScores(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && Number.isSafeInteger(entry.score) && entry.score >= 0
    && entry.score <= 1_000_000_000 && typeof entry.date === 'string'
    && Number.isFinite(Date.parse(entry.date)) && typeof entry.id === 'string')
    .map(({ score, date, id }) => ({ score, date, id }))
    .sort((a, b) => b.score - a.score || Date.parse(b.date) - Date.parse(a.date))
    .slice(0, MAX_SCORES);
}

export function readScores(storage) {
  try { return cleanScores(JSON.parse(storage.getItem(STORAGE_KEY) || '[]')); }
  catch { return []; }
}

export function writeScores(storage, scores) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cleanScores(scores)));
    return true;
  } catch { return false; }
}
