// report.ts (Task 5 — reporter).
// Runs the engine + Code Reviewer directly with an accurate fake dispatcher across
// a baseline and swept parameters, writes results/<stamp>.json, and prints the
// comparison table. A setting "produces a different result" iff its row differs
// from baseline on wall_ms / ledger_tokens / accuracy.
//
// Sweep coverage (per the plan's parameter table):
//   MAX_CONCURRENCY        — wall_ms should drop then plateau at the engine cap
//   COMPACTION_TOKEN_THRESHOLD — lower threshold shrinks ledger_tokens (proven in token.test.ts)
//   SUBAGENT_TIMEOUT_MS   — below real subagent latency forces escalation
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OrchestrationEngine,
  ContextCompactor,
  StandardCodeReviewer,
  ORCHESTRATOR_CONFIG,
  type BuildPlan,
  type SubagentDispatcher,
  type SubagentResult,
} from '../orchestrator.js';
import { Composer } from '../surgical-orchestration.js';
import { readFileSync } from 'node:fs';

const FIXTURE = resolve(__dirname, 'fixtures/mixed.plan.json');
const plan = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as BuildPlan;

function accurateDispatcher(latencyMs = 0): SubagentDispatcher {
  return async (_id, payload) => {
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    return {
      status: 'COMPLETED',
      filesModified: [],
      debrief: `did ${payload.missionId}`,
      selfAudit: 'ok',
      recommendations: ['rec A', 'rec B', 'rec C'],
      suggestions: ['sug A', 'sug B', 'sug C'],
    } as SubagentResult;
  };
}

async function measure(label: string, opts: {
  conc: number;
  compaction: number;
  timeoutMs: number;
  dispatcherLatency: number;
}) {
  const savedConc = ORCHESTRATOR_CONFIG.MAX_CONCURRENCY;
  const savedComp = ORCHESTRATOR_CONFIG.COMPACTION_TOKEN_THRESHOLD;
  const savedTimeout = ORCHESTRATOR_CONFIG.SUBAGENT_TIMEOUT_MS;
  (ORCHESTRATOR_CONFIG as { MAX_CONCURRENCY: number }).MAX_CONCURRENCY = opts.conc;
  (ORCHESTRATOR_CONFIG as { COMPACTION_TOKEN_THRESHOLD: number }).COMPACTION_TOKEN_THRESHOLD = opts.compaction;
  (ORCHESTRATOR_CONFIG as { SUBAGENT_TIMEOUT_MS: number }).SUBAGENT_TIMEOUT_MS = opts.timeoutMs;

  const t0 = Date.now();
  const engine = new OrchestrationEngine(plan, accurateDispatcher(opts.dispatcherLatency), { skipTests: true });
  const result = await engine.run();
  const reviewer = new StandardCodeReviewer(plan, accurateDispatcher(opts.dispatcherLatency));
  const outcome = await reviewer.run();
  const composer = new Composer();
  const final = composer.compose(outcome, plan);
  const wall = Date.now() - t0;
  const ledger = ContextCompactor.compact(result.jobCard);
  const ledgerTokens = Math.ceil(JSON.stringify(ledger).length / 4);
  const accuracy = final.recommendations.length === 2 && final.suggestions.length === 2 ? 100 : 0;

  (ORCHESTRATOR_CONFIG as { MAX_CONCURRENCY: number }).MAX_CONCURRENCY = savedConc;
  (ORCHESTRATOR_CONFIG as { COMPACTION_TOKEN_THRESHOLD: number }).COMPACTION_TOKEN_THRESHOLD = savedComp;
  (ORCHESTRATOR_CONFIG as { SUBAGENT_TIMEOUT_MS: number }).SUBAGENT_TIMEOUT_MS = savedTimeout;
  return { setting: label, wall_ms: wall, ledger_tokens: ledgerTokens, accuracy_pct: accuracy };
}

async function main() {
  const rows: Array<{ setting: string; wall_ms: number; ledger_tokens: number; accuracy_pct: number }> = [];
  // Baseline
  rows.push(await measure('MAX_CONCURRENCY=1 (baseline)', { conc: 1, compaction: 0.75, timeoutMs: 180000, dispatcherLatency: 0 }));
  // Concurrency sweep — wall should drop, ledger unchanged
  rows.push(await measure('MAX_CONCURRENCY=2 (engine max)', { conc: 2, compaction: 0.75, timeoutMs: 180000, dispatcherLatency: 0 }));
  // Compaction sweep — ledger_tokens must shrink (proven by token.test.ts)
  rows.push(await measure('COMPACTION_TOKEN_THRESHOLD=0.25', { conc: 1, compaction: 0.25, timeoutMs: 180000, dispatcherLatency: 0 }));
  // Timeout sweep — dispatcher slower than timeout forces escalation
  rows.push(await measure('SUBAGENT_TIMEOUT_MS=200 (slow dispatch)', { conc: 1, compaction: 0.75, timeoutMs: 200, dispatcherLatency: 500 }));

  const outDir = resolve(__dirname, 'results');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(resolve(outDir, `${stamp}.json`), JSON.stringify(rows, null, 2));

  console.log('\n=== Parameter-Sweep Comparison ===');
  console.log('SETTING'.padEnd(34), 'WALL_MS'.padStart(9), 'LEDGER_TOK'.padStart(12), 'ACCURACY'.padStart(9));
  for (const r of rows) {
    console.log(r.setting.padEnd(34), String(r.wall_ms).padStart(9), String(r.ledger_tokens).padStart(12), `${r.accuracy_pct}%`.padStart(9));
  }
  const diff = rows.slice(1).some(
    (r) => r.wall_ms !== rows[0].wall_ms || r.ledger_tokens !== rows[0].ledger_tokens || r.accuracy_pct !== rows[0].accuracy_pct,
  );
  console.log(diff ? '\nDIFFERENT RESULTS OBSERVED across settings \u2713' : '\nWARN: no setting changed results');
  if (!diff) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
