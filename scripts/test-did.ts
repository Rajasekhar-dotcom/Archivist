import fs from 'fs';
import path from 'path';
import { calculateDiD } from '../src/lib/did';

const dataDir = path.join(__dirname, '../data');
const posts = JSON.parse(fs.readFileSync(path.join(dataDir, 'posts.json'), 'utf-8'));
const metrics = JSON.parse(fs.readFileSync(path.join(dataDir, 'metrics.json'), 'utf-8'));
const groundtruth = JSON.parse(fs.readFileSync(path.join(dataDir, 'groundtruth.json'), 'utf-8'));

let allPassed = true;

for (const tc of groundtruth.cases) {
  if (tc.type === 'missing_topic') continue;

  const targets = tc.targets || [tc.target];
  
  for (const targetId of targets) {
    const targetPost = posts.find((p: any) => p.id === targetId);
    const targetMetrics = metrics[targetId];
    
    let targetPostTrajectory = targetMetrics.counterfactual_untouched;
    if (tc.type === 'update_stats') targetPostTrajectory = targetMetrics.counterfactual_refreshed.update_stats;
    if (tc.type === 'add_faq') targetPostTrajectory = targetMetrics.counterfactual_refreshed.add_faq;
    if (tc.type === 'contaminated_control') targetPostTrajectory = targetMetrics.counterfactual_refreshed.update_stats;

    const candidateControls = posts
      .filter((p: any) => p.cluster === targetPost.cluster && p.id !== targetId)
      .map((p: any) => ({
        id: p.id,
        pre: metrics[p.id].history,
        post: metrics[p.id].counterfactual_untouched,
        // Mark post_8 as the contaminated one
        touched: p.id === 'post_8'
      }));

    const result = calculateDiD(
      targetMetrics.history,
      targetPostTrajectory,
      candidateControls
    );

    console.log(`Test [${tc.type}] on ${targetId}:`);
    console.log(`  Effect: ${(result.effect * 100).toFixed(1)}%`);
    console.log(`  Label: ${result.label}`);
    console.log(`  Controls: ${result.controlCount}`);
    if (result.flaggedControls.length > 0) {
      console.log(`  Flagged: ${result.flaggedControls.join(', ')}`);
    }

    if (tc.expected_label && result.label !== tc.expected_label) {
      console.error(`  ❌ FAILED: Expected ${tc.expected_label}, got ${result.label}`);
      allPassed = false;
    } else if (tc.expected_action === 'flagged_and_excluded' && !result.flaggedControls.includes('post_8')) {
       console.error(`  ❌ FAILED: Expected post_8 to be flagged`);
       allPassed = false;
    } else {
      console.log(`  ✅ PASSED`);
    }
    console.log('');
  }
}

if (!allPassed) process.exit(1);
console.log("All deterministic DiD tests passed against ground truth!");
