export interface DiDResult {
  effect: number;
  label: 'improved' | 'no_effect' | 'worse' | 'inconclusive';
  controlCount: number;
  window: string;
  flaggedControls: string[];
  targetPreAvg: number;
  targetPostAvg: number;
  medianControlGrowth: number;
}

export function calculateDiD(
  targetPre: number[],
  targetPost: number[],
  candidateControls: { id: string; pre: number[]; post: number[]; touched: boolean }[]
): DiDResult {
  const PRE_PERIOD = 8;
  // We expect 8 weeks pre and 8 weeks post in the raw arrays, but we only use 4 weeks post (skipping week 1)
  
  const targetPreAvg = targetPre.slice(-PRE_PERIOD).reduce((a, b) => a + b, 0) / PRE_PERIOD;
  // Post weeks 2, 3, 4 (indices 1, 2, 3)
  const targetPostAvg = targetPost.slice(1, 4).reduce((a, b) => a + b, 0) / 3;

  if (targetPreAvg === 0) return {
    effect: 0,
    label: 'inconclusive',
    controlCount: 0,
    window: '8w/4w',
    flaggedControls: [],
    targetPreAvg,
    targetPostAvg,
    medianControlGrowth: 0
  };

  const targetGrowth = (targetPostAvg / targetPreAvg) - 1;

  const validControls = [];
  const flaggedControls = [];

  for (const control of candidateControls) {
    if (control.touched) {
      flaggedControls.push(control.id);
      continue;
    }

    const cPreAvg = control.pre.slice(-PRE_PERIOD).reduce((a, b) => a + b, 0) / PRE_PERIOD;
    
    // Traffic band check (+/- 35%)
    if (cPreAvg > targetPreAvg * 0.65 && cPreAvg < targetPreAvg * 1.35) {
      const cPostAvg = control.post.slice(1, 4).reduce((a, b) => a + b, 0) / 3;
      if (cPreAvg > 0) {
        validControls.push((cPostAvg / cPreAvg) - 1);
      }
    }
  }

  if (validControls.length < 3) {
    return {
      effect: 0,
      label: 'inconclusive',
      controlCount: validControls.length,
      window: '8w/4w',
      flaggedControls,
      targetPreAvg,
      targetPostAvg,
      medianControlGrowth: 0
    };
  }

  // Median of controls
  validControls.sort((a, b) => a - b);
  const mid = Math.floor(validControls.length / 2);
  const medianControlGrowth = validControls.length % 2 !== 0 
    ? validControls[mid] 
    : (validControls[mid - 1] + validControls[mid]) / 2;

  const effect = targetGrowth - medianControlGrowth;
  
  let label: DiDResult['label'] = 'no_effect';
  if (effect > 0.15) label = 'improved';
  else if (effect < -0.05) label = 'worse';

  return {
    effect,
    label,
    controlCount: validControls.length,
    window: '8w/4w',
    flaggedControls,
    targetPreAvg,
    targetPostAvg,
    medianControlGrowth
  };
}
