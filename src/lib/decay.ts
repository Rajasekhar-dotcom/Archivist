export interface Post {
  id: string;
  title: string;
  slug: string;
  cluster: string;
  publishedAt: string;
  baselineViews: number;
  causeHint: string;
  format: string;
}

export function detectDecay(history: number[]) {
  if (history.length < 8) return { isDecaying: false, peak: 0, current: 0, drop: 0, band: 'low' };

  // Calculate 4-week moving averages
  const mvas = [];
  for (let i = 0; i <= history.length - 4; i++) {
    const avg = history.slice(i, i + 4).reduce((a, b) => a + b, 0) / 4;
    mvas.push(avg);
  }

  const current = mvas[mvas.length - 1];
  const peak = Math.max(...mvas);
  const drop = peak > 0 ? (peak - current) / peak : 0;

  let consecutiveDrops = 0;
  for (let i = mvas.length - 1; i > 0; i--) {
    if (mvas[i] < mvas[i - 1]) consecutiveDrops++;
    else break;
  }

  const isDecaying = drop > 0.2 || consecutiveDrops >= 3;

  let band = 'low';
  if (current >= 1200) band = 'high';
  else if (current >= 400) band = 'mid';

  return { isDecaying, peak, current, drop, band };
}
