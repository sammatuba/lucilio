import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExport } from '../lib/api';
import { trustLoadCopy } from '../lib/copy';
import { CORRESPONDENT_CARDS } from '../../shared/constants';
import type { TrustPayload } from '../../shared/schemas';

interface RulesResults {
  generatedAt: string;
  gitSha?: string | null;
  total: number;
  passed: number;
  failed: number;
  categories: { category: string; passed: number; total: number; tests: { name: string; pass: boolean }[] }[];
}

interface EvalResults {
  generatedAt: string;
  gitSha?: string | null;
  personaVersion: string;
  mode: string;
  total: number;
  passed: number;
  failed: number;
  safetyFailures: number;
  groundingRate: number;
  targets: { safetyFailures: number; groundingRate: number };
  targetsMet: boolean;
  adversarial?: {
    gateTotal: number;
    gateRejected: number;
    judgeTotal: number;
    judgeRejected: number;
    judgeSkipped: number;
    pass: boolean;
  };
  cases: { fixture: string; cid: string; kind: string; pass: boolean; genre: string }[];
}

// Evidence provenance: when it was generated, at which commit, and how old it
// is — a stale snapshot must be visible as stale, not pass for current.
function provenance(generatedAt: string, gitSha?: string | null): string {
  const ageDays = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 86_400_000);
  const age = ageDays <= 0 ? 'today' : ageDays === 1 ? 'yesterday' : `${ageDays} days ago`;
  return `generated ${new Date(generatedAt).toLocaleString()} (${age})${gitSha ? ` at commit ${gitSha}` : ''}`;
}

export default function TrustCenter() {
  const [trust, setTrust] = useState<TrustPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get<TrustPayload>('/api/trust').then(setTrust).catch((e) => setError(trustLoadCopy(e)));
  }, []);

  if (error && !trust) return <div className="save-error">{error}</div>;
  if (!trust) return <p className="empty-note">Opening the Trust Center…</p>;

  const rules = trust.rulesResults as RulesResults | null;
  const evals = trust.evalResults as EvalResults | null;
  const evalByFixture = evals
    ? Object.entries(
        evals.cases.reduce<Record<string, { passed: number; total: number }>>((acc, c) => {
          const slot = acc[c.fixture] ?? { passed: 0, total: 0 };
          acc[c.fixture] = slot;
          slot.total += 1;
          if (c.pass) slot.passed += 1;
          return acc;
        }, {}),
      )
    : [];

  return (
    <>
      <h2 className="page-title">Trust Center</h2>
      <p className="page-sub">Your writing, your choices, and how the AI uses your words.</p>

      <div className="trust-section">
        <h3>What happens to my writing?</h3>
        <p>Your entries are stored in your Firebase account data. Other users cannot read them through the app. Our server can access the writing needed to provide the service.</p>
        <h3>When does AI read it?</h3>
        <p>Reflect on this sends the selected entry to Gemini through our server. Saving alone does not request a response unless you enable automatic reflection. Optional weekly letters use recent writing and correspondence memory.</p>
        <h3>What does it remember?</h3>
        <p>Entry reflections do not add to long-term memory. Correspondence letters can maintain summaries of themes and open questions. Individual memory correction is not available yet; account deletion includes stored memory.</p>
        <h3>Who controls the interpretation?</h3>
        <p>You do. AI can misread your experience. Depth, interests, and respectful challenge are choices you can change in Settings, or for any single entry when you ask for a reflection.</p>
        <p>Gemini processes the content it receives under its provider terms. This page cannot establish the billing or data-use status of the configured API project.</p>
      </div>

      <p className="vault-line">“{trust.vaultLine}”</p>

      {error && <div className="save-error">{error}</div>}

      <details className="trust-section">
        <summary>Technical details and test evidence</summary>

      <div className="trust-section">
        <h3>Security rules — unit test evidence</h3>
        {rules ? (
          <>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-soft)' }}>
              {rules.passed}/{rules.total} assertions passing ({provenance(rules.generatedAt, rules.gitSha)}).
              Every test runs against the real Firestore rules engine: owner-allowed, stranger-denied,
              unauthenticated-denied, and client-write-denied on all server-owned collections.
            </p>
            <table className="trust-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rules.categories.map((c) => (
                  <tr
                    key={c.category}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === c.category ? null : c.category)}
                  >
                    <td>{c.category}</td>
                    <td>
                      {c.passed === c.total ? `✓ ${c.passed}/${c.total}` : `✗ ${c.passed}/${c.total}`}
                      {expanded === c.category && ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expanded && rules.categories.find((c) => c.category === expanded) && (
              <ul style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-soft)' }}>
                {rules.categories
                  .find((c) => c.category === expanded)!
                  .tests.map((t) => (
                    <li key={t.name}>
                      {t.pass ? '✓' : '✗'} {t.name}
                    </li>
                  ))}
              </ul>
            )}
          </>
        ) : (
          <p className="empty-note">Rules test results are generated at build/CI time (npm run test:rules) and shipped as JSON.</p>
        )}
      </div>

      <div className="trust-section">
        <h3>Letter evals — quality &amp; safety evidence</h3>
        {evals ? (
          <>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-soft)' }}>
              {evals.passed}/{evals.total} eval cases passing, personas {evals.personaVersion} ({evals.mode} mode,{' '}
              {provenance(evals.generatedAt, evals.gitSha)}). Every seeded situation is run through each
              correspondent and judged on schema validity, grounding, and the §8 safety rubric — with targets of zero
              safety failures and ≥95% grounded claims. Deliberately violating letters are also pushed at the gate,
              which must reject every one.
            </p>
            {evals.mode === 'mock' && (
              <p style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
                Honesty note: mock mode exercises the eval harness with deterministic letters — it proves the
                schemas, grounding checks, and safety plumbing run and gate correctly, not live model behavior.
                Behavioral safety evidence comes from live-mode runs (real Gemini compose + judge), which are
                required before any persona change ships.
              </p>
            )}
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pill">
                {evals.safetyFailures === 0
                  ? `✓ safety failures: 0 (target 0)`
                  : `✗ safety failures: ${evals.safetyFailures} (target 0)`}
              </span>
              <span className="pill">
                {evals.groundingRate >= evals.targets.groundingRate
                  ? `✓ grounding rate: ${(evals.groundingRate * 100).toFixed(1)}% (target ≥ ${evals.targets.groundingRate * 100}%)`
                  : `✗ grounding rate: ${(evals.groundingRate * 100).toFixed(1)}% (target ≥ ${evals.targets.groundingRate * 100}%)`}
              </span>
              <span className="pill">fixtures: {evalByFixture.length}</span>
              {evals.adversarial && (
                <span className="pill">
                  {evals.adversarial.pass ? '✓' : '✗'} gate rejects bad letters:{' '}
                  {evals.adversarial.gateRejected}/{evals.adversarial.gateTotal}
                  {evals.adversarial.judgeSkipped > 0
                    ? ` (+${evals.adversarial.judgeSkipped} judge checks live-mode only)`
                    : ` · judge ${evals.adversarial.judgeRejected}/${evals.adversarial.judgeTotal}`}
                </span>
              )}
            </p>
            <table className="trust-table">
              <thead>
                <tr>
                  <th>Seeded situation</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {evalByFixture.map(([fixture, r]) => (
                  <tr key={fixture}>
                    <td>{fixture}</td>
                    <td>{r.passed === r.total ? `✓ ${r.passed}/${r.total}` : `✗ ${r.passed}/${r.total}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="empty-note">
            Letter eval results are generated by <code>npm run evals</code> and shipped as JSON.
          </p>
        )}
      </div>

      <div className="trust-section">
        <h3>Model ladder (pinned — never a rolling alias as primary)</h3>
        <p>
          {trust.modelLadder.map((m, i) => (
            <span className="pill" key={m}>
              {i + 1}. {m}
              {i === trust.modelLadder.length - 1 ? ' (last resort, logged loudly)' : ''}
            </span>
          ))}
        </p>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
          Personas version: {trust.personasVersion}. The Gemini key lives in Secret Manager in production and an
          uncommitted .env locally — it never reaches this browser.
        </p>
      </div>

      {trust.atlasPack && (
        <div className="trust-section">
          <h3>Atlas content pack</h3>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--ink-soft)' }}>
            Version {trust.atlasPack.version} — Edition “{trust.atlasPack.edition}”, {trust.atlasPack.plateCount}{' '}
            plates, {trust.atlasPack.sourceCount} listed sources. Imagery: {trust.atlasPack.imagery}.
          </p>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Plate essays are frozen like the personas: composed from the sources listed on each plate (with
            retrieval dates), reviewed before the edition ships, and versioned — no plate text is generated
            per user at runtime, and no Google Maps key ever reaches this browser.
          </p>
        </div>
      )}

      <div className="trust-section">
        <h3>App Check</h3>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5 }}>
          Mode: <span className="pill">{trust.appCheckMode}</span>
        </p>
      </div>

      <div className="trust-section">
        <h3>Memory version log (append-only, auditable)</h3>
        {trust.memoryLog.every((m) => m.versions.length === 0) ? (
          <p className="empty-note">No consolidated memory yet — versions appear after each cycle.</p>
        ) : (
          <table className="trust-table">
            <thead>
              <tr>
                <th>Correspondent</th>
                <th>Version</th>
                <th>Created</th>
                <th>Themes</th>
                <th>Open threads</th>
              </tr>
            </thead>
            <tbody>
              {trust.memoryLog.flatMap((m) =>
                m.versions.map((v) => (
                  <tr key={`${m.cid}-${v.version}`}>
                    <td>{CORRESPONDENT_CARDS[m.cid]?.name ?? m.cid}</td>
                    <td>v{v.version}</td>
                    <td>{new Date(v.createdAt).toLocaleString()}</td>
                    <td>{v.themes}</td>
                    <td>{v.openThreads}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="trust-section">
        <h3>Rate limits (the cadence caps are psychological safety, not scarcity)</h3>
        <table className="trust-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Window</th>
              <th>Max</th>
              <th>Recent peak use</th>
            </tr>
          </thead>
          <tbody>
            {trust.rateLimits.map((r) => (
              <tr key={r.scope}>
                <td>{r.scope}</td>
                <td>{Math.round(r.windowMs / 1000)}s</td>
                <td>{r.max}</td>
                <td>{r.used}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-faint)' }}>
          Plus one requested letter per correspondent per day, and one shared post day per week. There is no
          notification channel of any kind: nothing pings, nudges, or streaks here.
        </p>
      </div>

      </details>
      <div className="trust-section">
        <h3>Take your writing with you</h3>
        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-quiet" onClick={() => downloadExport()}>Export everything (JSON)</button>
        </p>
        <p>To delete your account and all data, visit <Link to="/settings">Settings</Link>.</p>
      </div>
    </>
  );
}
