import fs from 'fs';
import path from 'path';

class Mulberry32 {
  a: number;
  constructor(seed: number) { this.a = seed; }
  next() {
    this.a |= 0;
    this.a = (this.a + 0x6D2B79F5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextRange(min: number, max: number) { return min + this.next() * (max - min); }
}
const rng = new Mulberry32(42);

const CLUSTERS = ['api-infrastructure', 'pricing-billing', 'auth-security', 'analytics-reporting'];
const CLUSTER_BASELINES: Record<string, number> = {
  'api-infrastructure': 1500, 'pricing-billing': 800, 'auth-security': 500, 'analytics-reporting': 1200
};

interface Post { id: string; title: string; slug: string; cluster: string; publishedAt: string; baselineViews: number; causeHint: string; format: string; }

const posts: Post[] = [];
for (let i = 1; i <= 40; i++) {
  const cluster = CLUSTERS[i % 4];
  const baselineViews = Math.floor(CLUSTER_BASELINES[cluster] * rng.nextRange(0.9, 1.1));
  posts.push({
    id: `post_${i}`, title: `Best Practices for ${cluster.replace('-', ' ')} ${i}`, slug: `best-practices-${cluster}-${i}`,
    cluster, publishedAt: new Date(Date.now() - rng.nextRange(100, 300) * 86400000).toISOString(),
    baselineViews, causeHint: 'none', format: 'guide'
  });
}

const planted = {
  update_stats_targets: ['post_1', 'post_5', 'post_9'],
  add_faq_targets: ['post_2', 'post_6'],
  autonomous_rebound_target: 'post_3',
  contaminated_control: 'post_8', 
  contaminated_control_partner: 'post_4', 
};

planted.update_stats_targets.forEach(id => { const p = posts.find(p => p.id === id); if (p) p.causeHint = 'outdated_stats'; });
planted.add_faq_targets.forEach(id => { const p = posts.find(p => p.id === id); if (p) p.causeHint = 'thin_faq'; });
posts.find(p => p.id === planted.autonomous_rebound_target)!.causeHint = 'weak_intro';

const metrics: Record<string, any> = {};
const decayTargets = new Set(['post_1', 'post_2', 'post_3', 'post_5', 'post_6', 'post_9']);

for (const post of posts) {
  const history = [];
  let currentViews = post.baselineViews;
  for (let w = 1; w <= 12; w++) {
    const noise = rng.nextRange(0.95, 1.05);
    history.push(Math.round(currentViews * noise));
  }

  // Plant a visible four-week decline so the generated archive always exercises decay detection.
  if (decayTargets.has(post.id)) {
    const decline = [0.86, 0.78, 0.70, 0.62];
    history.splice(-4, 4, ...decline.map(multiplier => Math.round(post.baselineViews * multiplier)));
  }

  const PRE_AVG = history.slice(-8).reduce((a, b) => a + b, 0) / 8;

  const counterfactual_untouched = [];
  const counterfactual_refreshed: Record<string, number[]> = { update_stats: [], add_faq: [] };

  let untouchedViews = PRE_AVG;
  for (let w = 13; w <= 20; w++) {
    const noise = rng.nextRange(0.98, 1.02);
    if (post.id === planted.autonomous_rebound_target || post.cluster === posts.find(p=>p.id===planted.autonomous_rebound_target)?.cluster) {
      untouchedViews = PRE_AVG * 1.30; 
    } else {
      untouchedViews = PRE_AVG; 
    }
    counterfactual_untouched.push(Math.round(untouchedViews * noise));
  }

  for (let w = 13; w <= 20; w++) {
    const noise = rng.nextRange(0.98, 1.02);
    let usViews = untouchedViews;
    if (planted.update_stats_targets.includes(post.id)) usViews = PRE_AVG * 1.38;
    // ensure partner has normal trajectory if we refresh it as add_faq to test contaminated control
    if (post.id === planted.contaminated_control_partner) usViews = PRE_AVG * 1.10; 
    counterfactual_refreshed.update_stats.push(Math.round(usViews * noise));
    
    let faqViews = untouchedViews;
    if (planted.add_faq_targets.includes(post.id)) faqViews = PRE_AVG * 1.01;
    counterfactual_refreshed.add_faq.push(Math.round(faqViews * noise));
  }
  
  if (post.id === planted.contaminated_control) {
     for (let w = 13; w <= 20; w++) {
         counterfactual_untouched[w-13] = Math.round(counterfactual_untouched[w-13] * 1.5);
     }
  }

  metrics[post.id] = { history, counterfactual_untouched, counterfactual_refreshed };
}

const groundtruth = {
  cases: [
    { type: "update_stats", targets: planted.update_stats_targets, expected_effect: ">0.30", expected_label: "improved" },
    { type: "add_faq", targets: planted.add_faq_targets, expected_effect: "~0", expected_label: "no_effect" },
    { type: "autonomous_rebound", target: planted.autonomous_rebound_target, expected_label: "no_effect" },
    { type: "contaminated_control", target: planted.contaminated_control_partner, expected_action: "flagged_and_excluded" }
  ]
};

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
fs.writeFileSync(path.join(dataDir, 'posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(path.join(dataDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
fs.writeFileSync(path.join(dataDir, 'groundtruth.json'), JSON.stringify(groundtruth, null, 2));

console.log("Synthetic data generated successfully.");
