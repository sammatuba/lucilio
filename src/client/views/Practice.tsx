import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../lib/api';
import { inquiryDocSchema, type Inquiry } from '../../shared/inquiry';
import { philosophyPackSchema, type PhilosophyPack } from '../../shared/philosophy';
import { inquiryRequest } from '../lib/inquiryDraft';

export default function Practice() {
  const [pack, setPack] = useState<PhilosophyPack | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showResting, setShowResting] = useState(false);
  const pending = useRef<{ id: string; question: string } | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setError('');
    inquiryRequest(Promise.all([api.get('/api/philosophy'), api.get('/api/inquiries')])).then(([library, saved]) => {
      const parsedPack = philosophyPackSchema.parse(library);
      const parsedSaved = z.object({ inquiries: z.array(inquiryDocSchema) }).parse(saved);
      if (active) { setPack(parsedPack); setInquiries(parsedSaved.inquiries); setLoaded(true); }
    }).catch(() => { if (active) setError('Your practice could not be loaded. Your saved writing has not changed.'); });
    return () => { active = false; };
  }, [attempt]);
  async function begin() {
    const text = question.trim();
    if (!text || busy) return;
    if (pending.current?.question !== text) pending.current = { id: crypto.randomUUID(), question: text };
    setBusy(true); setCreateError('');
    try {
      const result = inquiryDocSchema.parse(await inquiryRequest(api.post('/api/inquiries', { ...pending.current, readingId: null, parentId: null, nodeIds: [] })));
      navigate(`/inquiry/${result.id}`);
    } catch { setCreateError('The inquiry could not be confirmed. Your question is still here; retry to check or save it.'); }
    finally { setBusy(false); }
  }
  const starter = pack?.readings.find((r) => r.id === 'trust') ?? pack?.readings[0];
  const active = inquiries.filter((q) => q.status === 'active');
  const resting = inquiries.filter((q) => q.status !== 'active');
  return <main className="practice-page">
    <p className="practice-eyebrow">Read widely. Think for yourself.</p>
    <h1 className="practice-title">A question worth staying with.</h1>
    <p className="practice-intro">Philosophy begins with something that catches your attention. Read first, follow your own question, and give your thoughts room to become clearer.</p>
    {error && <div className="save-error" role="alert"><span>{error}</span><button className="btn-quiet" onClick={() => setAttempt((n) => n + 1)}>Retry practice</button></div>}
    {!loaded && !error && <p role="status">Opening your practice…</p>}
    {starter && <section className="practice-feature" aria-labelledby="starting-reading">
      <div className="practice-feature-label">A place to begin · not an assignment</div>
      <h2 id="starting-reading">{starter.question}</h2>
      <p>{starter.standfirst}</p>
      <Link className="btn-primary" to={`/read/${starter.id}`}>Read the essay</Link>
      <p className="composer-hint">{starter.minutes} minutes of reading · no writing required to enter</p>
    </section>}
    <section className="practice-threads" aria-labelledby="your-inquiries">
      <div className="practice-section-heading"><h2 id="your-inquiries">Your open questions</h2><Link to="/philosophy">Explore the philosophy map</Link></div>
      {loaded && active.length === 0 && <p className="page-sub">No inquiry needs you yet. Begin with a reading, or bring a question of your own below.</p>}
      <div className="inquiry-list">{active.map((q) => <InquiryCard key={q.id} inquiry={q} />)}</div>
      {resting.length > 0 && <>
        <button className="btn-quiet" aria-expanded={showResting} onClick={() => setShowResting((v) => !v)}>{showResting ? 'Hide' : 'Show'} paused and resting inquiries ({resting.length})</button>
        {showResting && <div className="inquiry-list">{resting.map((q) => <InquiryCard key={q.id} inquiry={q} />)}</div>}
      </>}
    </section>
    {pack && <section aria-labelledby="other-doors"><h2 id="other-doors">Other ways in</h2><p className="page-sub">Your research can start a question. It does not decide where the question goes.</p>
      <div className="practice-readings">{pack.readings.filter((r) => r.id !== starter?.id).map((r) => <Link className="practice-reading-card" key={r.id} to={`/read/${r.id}`}><span>{r.minutes} min · essay</span><h3>{r.title}</h3><p>{r.question}</p><span>Read and explore →</span></Link>)}</div>
    </section>}
    <section className="practice-own-question" aria-labelledby="own-question"><h2 id="own-question">Something else on your mind?</h2><p>It does not need to belong to a school, fit your research, or have a clear answer.</p>
      <form onSubmit={(e) => { e.preventDefault(); void begin(); }}><label htmlFor="new-inquiry-question">Your question</label><input id="new-inquiry-question" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="What am I trying to understand?" />
        <button className="btn-quiet" disabled={busy || !question.trim()}>{busy ? 'Opening inquiry…' : 'Begin with my question'}</button></form>
      {createError && <p role="alert">{createError}</p>}
      <p><Link to="/notebook">Or write freely in your Notebook</Link></p>
    </section>
    <details className="practice-rhythm"><summary>A gentle weekly rhythm · 2–3 hours</summary><p>Read for 40 minutes. Reflect for 25. Compare and explore for 30. Write or revise for 40. Leave 15 to notice what changed.</p><p>These are suggestions, not timers. Stay with an inquiry for several weeks, branch, pause, or leave it unresolved. There is no streak, deadline, or backlog.</p></details>
  </main>;
}
function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return <Link className="inquiry-card" to={`/inquiry/${inquiry.id}`}><span className="practice-eyebrow">{inquiry.parentId ? 'A branch of an earlier question' : 'Your inquiry'} · {inquiry.status}</span><h3>{inquiry.question}</h3><span>Return to this question →</span></Link>;
}
