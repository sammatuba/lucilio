import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inquiryCreateSchema, inquiryDocSchema } from '../../shared/inquiry';
import type { PhilosophyPack, PhilosophyReading } from '../../shared/philosophy';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { readReadingDraft, removeReadingDraft, writeReadingDraft, withReadingDraftLock, type ReadingDraft } from '../lib/readingDraft';
import { api } from '../lib/api';
import { inquiryRequest } from '../lib/inquiryDraft';
import PhilosophySources, { PhilosophyMarkdown, PhilosophyPackStatus, usePhilosophyPack } from '../components/PhilosophySources';

export default function Reading({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const { pack, state, retry } = usePhilosophyPack();
  const reading = pack?.readings.find((item) => item.id === id);

  if (state !== 'ready') {
    return (
      <section className="reading-page" aria-labelledby="reading-state-title">
        <h1 id="reading-state-title">The reading room</h1>
        <PhilosophyPackStatus state={state} retry={retry} />
      </section>
    );
  }
  if (!pack || !reading) {
    return (
      <section className="reading-page" aria-labelledby="reading-missing-title">
        <h1 id="reading-missing-title">Reading not found</h1>
        <p role="status">That reading is not in this edition. Nothing has been created or changed.</p>
        <Link to="/philosophy">Browse the philosophy map</Link>
        {pack && <>
          <h2>Choose another reading</h2>
          <ul>{pack.readings.map((item) => (
            <li key={item.id}><Link to={`/read/${encodeURIComponent(item.id)}`}>{item.title}</Link></li>
          ))}</ul>
        </>}
      </section>
    );
  }
  // Reset question and operation IDs when React reuses this route.
  return <ReadingArticle key={JSON.stringify([user.uid, reading.id])} user={user} reading={reading} pack={pack} />;
}

function ReadingArticle({ user, reading, pack }: { user: User; reading: PhilosophyReading; pack: PhilosophyPack }) {
  const navigate = useNavigate();
  const [initial] = useState(() => {
    try { return { draft: readReadingDraft(user.uid, reading.id), unreadable: false }; }
    catch { return { draft: null, unreadable: true }; }
  });
  const [draft, setDraft] = useState<ReadingDraft>(initial.draft ?? { question: reading.question, attempts: [] });
  const { question } = draft;
  const [unreadable, setUnreadable] = useState(initial.unreadable);
  const [storageError, setStorageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorAttempts = useRef(new Map(draft.attempts.map(attempt => [attempt.question, attempt])));
  const pending = useRef(false);
  const active = useRef(true);
  const primaryIds = reading.sourceIds.filter((id) => pack.sources.some((source) => source.id === id && source.kind === 'primary'));
  const validQuestion = question.trim().length > 0 && question.length <= 300;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function editQuestion(value: string) {
    setDraft(previous => ({ ...previous, question: value }));
    if (unreadable) return;
    try {
      await withReadingDraftLock(user.uid, reading.id, () => {
        if (auth.currentUser !== user) return;
        const attempts = readReadingDraft(user.uid, reading.id)?.attempts ?? [];
        if (value === reading.question && !attempts.length) removeReadingDraft(user.uid, reading.id);
        else writeReadingDraft(user.uid, reading.id, { question: value, attempts });
      });
      setStorageError(false);
    } catch { setStorageError(true); }
  }

  async function beginInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !validQuestion || unreadable || auth.currentUser !== user) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      let payload: ReadingDraft['attempts'][number] | null;
      try {
        payload = await withReadingDraftLock(user.uid, reading.id, () => {
          if (auth.currentUser !== user) return null;
          const attempts = readReadingDraft(user.uid, reading.id)?.attempts ?? [];
          const prior = attempts.find(attempt => attempt.question === question.trim() && attempt.readingId === reading.id);
          if (prior) return prior;
          const candidate = editorAttempts.current.get(question.trim()) ?? inquiryCreateSchema.parse({
            id: crypto.randomUUID(), question, readingId: reading.id, parentId: null, nodeIds: reading.nodeIds,
          });
          writeReadingDraft(user.uid, reading.id, { question, attempts: [...attempts, candidate] });
          return candidate;
        });
        setStorageError(false);
      } catch { setStorageError(true); return; }
      if (!payload || auth.currentUser !== user) return;
      editorAttempts.current.set(payload.question, payload);
      const inquiry = inquiryDocSchema.parse(await inquiryRequest(api.post<unknown>('/api/inquiries', payload)));
      if (inquiry.id !== payload.id) throw new Error('Unconfirmed inquiry');
      if (auth.currentUser !== user) return;
      // A later visit may have edited the draft while this request was pending.
      let cleanupFailed = false;
      try {
        await withReadingDraftLock(user.uid, reading.id, () => {
          if (auth.currentUser !== user) return;
          const stored = readReadingDraft(user.uid, reading.id);
          if (!stored?.attempts.some(attempt => attempt.id === inquiry.id)) return;
          const attempts = stored.attempts.filter(attempt => attempt.id !== inquiry.id);
          if (stored.question !== question) {
            writeReadingDraft(user.uid, reading.id, { ...stored, attempts });
          } else if (attempts.length) {
            writeReadingDraft(user.uid, reading.id, { question: attempts[attempts.length - 1]!.question, attempts });
          } else {
            removeReadingDraft(user.uid, reading.id);
          }
        });
      } catch { cleanupFailed = true; }
      if (active.current && auth.currentUser === user) {
        navigate(`/inquiry/${encodeURIComponent(inquiry.id)}`, { state: { readingDraftCleanupFailed: cleanupFailed } });
      }
    } catch {
      if (active.current) setError('We could not confirm that your inquiry was saved. Your question is still here. Retry the same question to safely repeat the request.');
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  }

  return (
    <article className="reading-page" aria-labelledby="reading-title">
      <nav className="reading-navigation" aria-label="Reading navigation"><Link to="/philosophy">Explore the philosophy map</Link></nav>
      <header className="reading-header" data-reading={reading.id}>
        <p className="philosophy-eyebrow">An original editorial essay · {reading.minutes} minutes of reading</p>
        <h1 id="reading-title">{reading.title}</h1>
        <p className="reading-standfirst">{reading.standfirst}</p>
        <p className="reading-question">{reading.question}</p>
        <a href="#reading-begin-title">Jump to your question</a>
      </header>
      <details className="philosophy-coverage">
        <summary>What you are reading: sources &amp; coverage</summary>
        <p>This is an original, source-guided editorial essay, not a translation, a primary text, or an exhaustive scholarly account.
          It is part of a fixed library, not generated or personalized on demand.</p>
        <p>{pack.coverageNote}</p>
        <p>{reading.sourceNotes}</p>
        <p className="philosophy-meta">Pack {pack.version}. Read the sources in context; traditions may disagree with this framing.</p>
      </details>

      <section className="reading-essay" aria-label="Editorial essay">
        <PhilosophyMarkdown>{reading.bodyMd}</PhilosophyMarkdown>
      </section>

      <details className="reading-counterpoint">
        <summary>A contrasting position</summary>
        <PhilosophyMarkdown>{reading.counterpointMd}</PhilosophyMarkdown>
      </details>

      <section className="reading-primary" aria-labelledby="reading-primary-title">
        <h2 id="reading-primary-title">Read a short primary passage</h2>
        <p>Open a source at the locator below and choose a paragraph or short passage to read slowly.
          Check its surrounding argument and the translator’s notes. Primary texts are linked, not reproduced here;
          translation and reuse rights vary by edition.</p>
        {primaryIds.length ? <PhilosophySources sources={pack.sources} sourceIds={primaryIds} />
          : <p>No directly linked primary text accompanies this essay yet. The references below are secondary guides, not substitutes for a primary passage.</p>}
      </section>

      <section className="reading-invitations" aria-labelledby="reading-invitations-title">
        <h2 id="reading-invitations-title">Ways to work with this reading</h2>
        <p>Choose an invitation, not an assignment. Write privately in an inquiry, on paper, or simply keep the question open.</p>
        <h3>Interpret</h3>
        <p>Restate one claim in your own words. Locate its support in a source, and distinguish the author’s claim from this essay’s interpretation.</p>
        <h3>Reflect</h3><p>{reading.prompts.reflection}</p>
        <h3>Build an argument</h3><p>{reading.prompts.argument}</p>
        <h3>Revise</h3><p>{reading.prompts.revision}</p>
      </section>

      <section className="reading-rhythm" aria-labelledby="reading-rhythm-title">
        <h2 id="reading-rhythm-title">A rhythm for 2–3 hours</h2>
        <p>A possible 150-minute week, in one sitting or several. It is guidance, not a timer, deadline, streak, or requirement.</p>
        <ol>
          <li><strong>40 minutes · Read</strong> the essay and a short source passage.</li>
          <li><strong>25 minutes · Reflect</strong> on a concrete experience and what it makes you question.</li>
          <li><strong>30 minutes · Compare</strong> the contrasting position or explore a connected map entry.</li>
          <li><strong>40 minutes · Write or revise</strong> one claim, its reasons, and a serious objection.</li>
          <li><strong>15 minutes · Gather</strong> what changed and the question you want to carry forward.</li>
        </ol>
        <p>Stop earlier, return later, or leave it unresolved. No AI or research topic is required.</p>
      </section>

      <section className="reading-begin" aria-labelledby="reading-begin-title">
        <h2 id="reading-begin-title" tabIndex={-1}>Make the question your own</h2>
        <p>An inquiry is a place to keep a question and your writing. Begin with this reading or take it somewhere unexpected.
          Beginning saves only the question and its reading/map links; it does not request an AI response.</p>
        <form onSubmit={beginInquiry} aria-busy={saving}>
          <label htmlFor="reading-initial-question">Your initial question</label>
          <textarea id="reading-initial-question" value={question} maxLength={300} rows={3}
            required disabled={saving} aria-describedby="reading-question-help reading-question-count"
            onChange={(event) => editQuestion(event.target.value)} />
          <p id="reading-question-help" className="philosophy-meta">Up to 300 characters. You can change direction later. Your draft is kept on this device for this account until you begin the inquiry or sign out.</p>
          <p id="reading-question-count" className="philosophy-meta">{question.length} / 300 characters</p>
          {storageError && <p role="alert">This browser could not keep your latest question and retry details. Copy your words before leaving, or try again with browser storage available.</p>}
          {unreadable && <div role="alert">Your stored question could not be read.
            <button type="button" onClick={() => {
              try {
                writeReadingDraft(user.uid, reading.id, draft);
                setUnreadable(false);
              } catch { setStorageError(true); }
            }}>Replace the unreadable draft with this question</button>
          </div>}
          {error && <div className="reading-error" role="alert">
            <p>{error}</p>
            <p>If you change the question before retrying, that is a separate inquiry; the earlier attempt may already have been saved.</p>
          </div>}
          {!error && draft.attempts.length > 0 && !saving && <p role="status">An earlier save is unconfirmed. Retry the same question to resume it. A different question starts a separate inquiry.</p>}
          <button className="reading-button" type="submit" disabled={saving || unreadable || !validQuestion}>
            {saving ? 'Beginning your inquiry…' : error ? 'Try again to begin an inquiry' : 'Begin an inquiry'}
          </button>
          {saving && <p className="philosophy-meta" role="status">Saving your question. No AI is being called.</p>}
        </form>
      </section>

      <section className="reading-map-links" aria-labelledby="reading-map-title">
        <h2 id="reading-map-title">Explore the ideas</h2>
        <ul>{reading.nodeIds.map((id) => (
          <li key={id}><Link to={`/philosophy?${new URLSearchParams({ node: id })}`}>{pack.nodes.find((node) => node.id === id)?.title}</Link></li>
        ))}</ul>
      </section>
      <section className="reading-sources" aria-labelledby="reading-sources-title">
        <h2 id="reading-sources-title">Sources &amp; editorial notes</h2>
        <p>{reading.sourceNotes}</p>
        <p className="philosophy-meta">Sources open externally in a new tab and are not fetched into your inquiry or an AI context.
          If a source is unavailable, this essay and your writing remain available.</p>
        <PhilosophySources sources={pack.sources} sourceIds={reading.sourceIds} />
      </section>
    </article>
  );
}
