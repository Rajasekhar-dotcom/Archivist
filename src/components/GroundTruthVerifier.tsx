'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface GroundTruthCase {
  type: string;
  targets?: string[];
  target?: string;
  expected_label?: string;
  expected_action?: string;
}

interface VerificationResult {
  caseType: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface GroundTruthVerifierProps {
  cases: GroundTruthCase[];
  outcomes: Array<{ postId: string; did: { label: string; flaggedControls: string[] } }>;
}

export default function GroundTruthVerifier({ cases, outcomes }: GroundTruthVerifierProps) {
  const results: VerificationResult[] = cases.flatMap(testCase => {
    const ids = testCase.targets || (testCase.target ? [testCase.target] : []);
    return ids.map(postId => {
      const outcome = outcomes.find(item => item.postId === postId);
      const expected = testCase.expected_label || testCase.expected_action || 'not evaluated';
      const actual = outcome?.did.label || 'not run';
      const passed = testCase.expected_action === 'flagged_and_excluded'
        ? Boolean(outcome?.did.flaggedControls.length)
        : actual === expected;
      return { caseType: testCase.type, expected, actual, passed };
    });
  });
  const passedCount = results.filter(result => result.passed).length;

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} className="text-emerald-600" /> Ground-truth verifier</h2>
        <span className="text-xs font-semibold text-slate-500">{passedCount}/{results.length || 0} checks passed</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {results.map((result, index) => (
          <div key={`${result.caseType}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-slate-800">{result.caseType.replaceAll('_', ' ')}</p>
              <p className="text-xs text-slate-500">Expected: {result.expected} · Actual: {result.actual}</p>
            </div>
            <CheckCircle2 size={17} className={result.passed ? 'text-emerald-600' : 'text-slate-300'} />
          </div>
        ))}
      </div>
      {results.length === 0 && <p className="text-sm text-slate-500">Run the experiment to verify planted outcomes.</p>}
    </section>
  );
}
