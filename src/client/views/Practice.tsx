import ReadingSketch from '../components/ReadingSketch';
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
  // The inquiry index returns the most recently updated items first.
  const [latest, ...otherActive] = active;
  const resting = inquiries.filter((q) => q.status !== 'active');
  return <main className="practice-page">
    <h1 className="practice-title">Practice</h1>
    {error && <div className="save-error" role="alert"><span>{error}</span><button className="btn-quiet" onClick={() => setAttempt((n) => n + 1)}>Retry practice</button></div>}
    {!loaded && !error && <p role="status">Opening your practice…</p>}
    {latest && <section className="practice-feature" aria-labelledby="resume-question">
      <div className="practice-feature-label">Your latest open question</div>
      <h2 id="resume-question">{latest.question}</h2>
      <Link className="btn-primary" to={`/inquiry/${latest.id}`}>Continue this question</Link>
    </section>}
    {!latest && starter && <section className="practice-feature" aria-labelledby="starting-reading">
      <div className="practice-feature-label">A reading to begin with</div>
      <h2 id="starting-reading">{starter.question}</h2>
      <p>{starter.standfirst}</p>
      <ReadingSketch id={starter.id} />
      <Link className="btn-primary" to={`/read/${starter.id}`}>Read the essay</Link>
      <p className="composer-hint">{starter.minutes} minutes of reading</p>
    </section>}
    {(otherActive.length > 0 || resting.length > 0) && <section className="practice-threads" aria-labelledby="your-inquiries">
      <h2 id="your-inquiries">Your other questions</h2>
      <div className="inquiry-list">{otherActive.map((q) => <InquiryCard key={q.id} inquiry={q} />)}</div>
      {resting.length > 0 && <>
        <button className="btn-quiet" aria-expanded={showResting} onClick={() => setShowResting((v) => !v)}>{showResting ? 'Hide' : 'Show'} paused and resting inquiries ({resting.length})</button>
        {showResting && <div className="inquiry-list">{resting.map((q) => <InquiryCard key={q.id} inquiry={q} />)}</div>}
      </>}
    </section>}
    <section className="practice-own-question" aria-labelledby="own-question"><h2 id="own-question">Begin with your own question</h2>
      <form onSubmit={(e) => { e.preventDefault(); void begin(); }}><label htmlFor="new-inquiry-question">Your question</label><input id="new-inquiry-question" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="What am I trying to understand?" />
        <button className="btn-quiet" disabled={busy || !question.trim()}>{busy ? 'Opening inquiry…' : 'Begin with my question'}</button></form>
      {createError && <p role="alert">{createError}</p>}
      <p><Link to="/notebook">Write freely in Notebook</Link></p>
    </section>
    <p><Link to="/explore">Browse essays, the Philosophy Map, and Atlas</Link></p>
    <details className="practice-rhythm"><summary>A gentle weekly rhythm · 2–3 hours</summary><p>Read for 40 minutes. Reflect for 25. Compare and explore for 30. Write or revise for 40. Leave 15 to notice what changed.</p><p>These are suggestions, not timers. Stay with an inquiry for several weeks, branch, pause, or leave it unresolved. There is no streak, deadline, or backlog.</p></details>
  </main>;
}
function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return <Link className="inquiry-card" to={`/inquiry/${inquiry.id}`}><span className="practice-eyebrow">{inquiry.parentId ? 'A branch of an earlier question' : 'Your inquiry'} · {inquiry.status}</span><h3>{inquiry.question}</h3><span>Return to this question →</span></Link>;
}
