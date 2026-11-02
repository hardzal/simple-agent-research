/** Same-origin developer extension, not a replacement for Anvia's bundled UI. */
export const studioMonitorPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Research Studio · Metrics &amp; Evals</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#111316;color:#e5e7eb}*{box-sizing:border-box}body{margin:0}header{display:flex;align-items:center;gap:18px;padding:12px 20px;border-bottom:1px solid #363b42}h1{font-size:18px;margin:0}a{color:#95c9ff}#connection{margin-left:auto;font-size:13px}main{display:grid;grid-template-columns:minmax(400px,1fr) minmax(440px,1fr);height:calc(100vh - 54px)}iframe{border:0;width:100%;height:100%;background:#15171b}aside{overflow:auto;padding:20px;border-left:1px solid #363b42}h2{font-size:17px;margin:0 0 12px}p{font-size:13px;line-height:1.6;color:#b6bec9}section{margin-bottom:28px}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;vertical-align:top;white-space:nowrap;padding:10px 8px;border-bottom:1px solid #30353c}th{color:#aeb8c5;font-weight:500}button{background:#d6e8ff;color:#10283f;border:0;border-radius:5px;padding:9px 12px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}code{font-size:11px}.eval{padding:12px 0;border-bottom:1px solid #363b42}.pass{color:#9fdeb5}.fail,.invalid{color:#f9adae}.running{color:#edd38e}#run-message{min-height:20px}@media(max-width:1000px){main{display:block;height:auto}iframe{height:65vh}aside{border-left:0;border-top:1px solid #363b42}}
</style><script src="/research-monitor/client.js" defer></script></head>
<body><header><h1>Metrics &amp; Evals</h1><a href="/playground" target="_blank" rel="noopener">Open Playground</a><span id="connection" role="status">Connecting…</span></header>
<main><iframe src="/playground" title="Anvia Studio Playground"></iframe><aside>
<section><h2>Research metrics · live</h2><p>Developer extension for Anvia Studio 1.3.20. Refreshes every 500 ms. Counts are runtime attempts, not billing. Missing token usage is unavailable, never assumed zero.</p><div class="scroll"><table><thead><tr><th>Run / SDK run</th><th>Status</th><th>Elapsed</th><th>Model / tools / search</th><th>Tokens in / out</th><th>Report verified</th><th>Error</th></tr></thead><tbody id="runs"></tbody></table></div><p id="empty-runs">No research runs observed in this Studio process.</p></section>
<section><h2>Offline contract evals</h2><p>Five scripted cases with fake model/search and real temporary file round-trips. No paid API calls. This is not real-model quality scoring and does not automatically evaluate chats.</p><button id="run-eval" type="button">Run 5 offline cases</button><p id="run-message" role="status"></p><div id="eval-runs"></div></section>
<p>History is in memory only: at most 100 research runs, 20 eval runs, and 30 minutes since the last update. Restart clears it. Native persisted Traces and conversation sessions remain disabled.</p>
</aside></main></body></html>`;

export const studioMonitorClient = `
const byId = id => document.getElementById(id);
const cell = value => { const node = document.createElement('td'); node.textContent = String(value); return node; };
const label = value => value === null ? 'unavailable' : String(value);
const shortId = value => value ? value.slice(0, 8) : '—';
function render(snapshot) {
  const body = byId('runs'); body.replaceChildren();
  byId('empty-runs').hidden = snapshot.runs.length > 0;
  for (const run of snapshot.runs) {
    const row = document.createElement('tr');
    const identity = cell(shortId(run.runId) + ' / ' + shortId(run.sdk_run_id));
    identity.title = run.runId + ' / SDK ' + (run.sdk_run_id ?? 'unavailable');
    row.append(identity, cell(run.run_status), cell((run.run_duration_ms / 1000).toFixed(1) + ' s'),
      cell(run.model_calls + ' / ' + run.tool_calls + ' / ' + run.web_search_calls),
      cell(label(run.input_tokens) + ' / ' + label(run.output_tokens)), cell(run.report_verified ? 'yes' : 'no'), cell(run.error_type ?? '—'));
    body.append(row);
  }
  const evals = byId('eval-runs'); evals.replaceChildren();
  for (const run of snapshot.evalRuns) {
    const box = document.createElement('article'); box.className = 'eval';
    const heading = document.createElement('p'); heading.className = run.status === 'passed' ? 'pass' : run.status === 'failed' ? 'fail' : 'running';
    heading.textContent = shortId(run.runId) + ' · ' + run.status + ' · scored ' + run.completedCases + '/' + run.totalCases + ' cases';
    heading.title = 'Core eval run: ' + run.runId; box.append(heading);
    if (run.totals) { const totals = document.createElement('p'); totals.textContent = 'Native case totals: ' + run.totals.passed + ' pass / ' + run.totals.failed + ' fail / ' + run.totals.invalid + ' invalid'; box.append(totals); }
    const table = document.createElement('table');
    for (const testCase of run.cases) {
      const row = document.createElement('tr'); row.append(cell(testCase.id));
      for (const name of ['mandatory-contract', 'fixture-quality-review']) {
        const metric = testCase.metrics.find(value => value.name === name);
        const item = cell(name + ': ' + (metric ? metric.outcome + ' (' + label(metric.score) + ')' : 'pending'));
        if (metric) item.className = metric.outcome; row.append(item);
      }
      table.append(row);
    }
    const scroll = document.createElement('div'); scroll.className = 'scroll'; scroll.append(table); box.append(scroll); evals.append(box);
  }
}
let stopped = false;
async function refresh() {
  if (stopped) return;
  try {
    const response = await fetch('/research-monitor/state', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('monitor unavailable');
    render(await response.json());
    byId('connection').textContent = 'Connected · live (500 ms polling)';
  } catch { byId('connection').textContent = 'Disconnected · retrying'; }
  if (!stopped) setTimeout(refresh, 500);
}
byId('run-eval').addEventListener('click', async () => {
  const button = byId('run-eval'); button.disabled = true;
  byId('run-message').textContent = 'Running offline suite…';
  try {
    const response = await fetch('/evals/research-offline/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('eval request failed');
    const result = await response.json();
    const totals = result.result.cases;
    byId('run-message').textContent = 'Finished: ' + totals.passed + '/' + totals.total + ' passed; ' + totals.failed + ' failed; ' + totals.invalid + ' invalid.';
  } catch { byId('run-message').textContent = 'Eval request failed or timed out. No automatic retry. Check the observed run status.'; }
  finally { button.disabled = false; }
});
window.addEventListener('pagehide', () => { stopped = true; });
refresh();
`;
