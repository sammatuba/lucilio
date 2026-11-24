import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { api, ApiError } from '../lib/api';
import { libraryHref } from '../lib/inquiryNavigation';
import { renderMarkdown } from '../lib/markdown';
import { inquiryDetailSchema, inquiryDocSchema, inquiryWritingSchema, writingModes, type InquiryDetail, type InquiryWriting, type WritingMode } from '../../shared/inquiry';
import { philosophyPackSchema, type PhilosophyPack } from '../../shared/philosophy';
import { byteLength } from '../../shared/schemas';
import { downloadWriting, freshInquiryDraft, inquiryRequest, readInquiryDraft, removeInquiryDraft, writeInquiryDraft, type InquiryDraft } from '../lib/inquiryDraft';

export default function Inquiry({ user }: { user: User }) {
  const { id = '' } = useParams();
  return <InquiryPage key={`${user.uid}:${id}`} id={id} user={user} />;
}
function InquiryPage({ id, user }: { id: string; user: User }) {
  const [data, setData] = useState<InquiryDetail | null>(null);
  const [pack, setPack] = useState<PhilosophyPack | null>(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [updateError, setUpdateError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [question, setQuestion] = useState('');
  const [branch, setBranch] = useState('');
  const [branchBusy, setBranchBusy] = useState(false);
  const [branchError, setBranchError] = useState('');
  const branchAttempt = useRef<Pick<InquiryDetail['inquiry'], 'id' | 'question' | 'parentId' | 'readingId' | 'nodeIds'> | null>(null);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    setLoadError('');
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) { setLoadError('This inquiry is not available.'); return; }
    inquiryRequest(Promise.all([api.get(`/api/inquiries/${id}`), api.get('/api/philosophy')])).then(([detail, library]) => {
      const parsed = inquiryDetailSchema.parse(detail);
      const content = philosophyPackSchema.parse(library);
      if (live) { setData(parsed); setQuestion(parsed.inquiry.question); setPack(content); }
    }).catch((e) => { if (live) setLoadError(e instanceof ApiError && e.status === 404 ? 'This inquiry is not available in your account.' : 'Your inquiry could not be loaded. Your writing has not been changed.'); });
    return () => { live = false; };
  }, [id, attempt]);
  async function update(values: { question?: string; status?: 'active' | 'paused' | 'resting'; nodeIds?: string[] }) {
    if (!data || updating) return;
    setUpdating(true); setUpdateError('');
    try {
      const inquiry = inquiryDocSchema.parse(await inquiryRequest(api.post(`/api/inquiries/${id}`, { ...values, revision: data.inquiry.revision })));
      setData((d) => d ? { ...d, inquiry } : d);
    } catch (e) {
      setUpdateError(e instanceof ApiError && e.status === 409 ? 'This inquiry changed in another view. Your proposed question is still above. Copy it if needed, then reload before retrying.' : 'The change was not confirmed. Your writing is safe; reload to check before trying again.');
    } finally { setUpdating(false); }
  }
  async function createBranch() {
    if (!data || !branch.trim() || branchBusy) return;
    const text = branch.trim();
    if (branchAttempt.current?.question !== text) branchAttempt.current = { id: crypto.randomUUID(), question: text, parentId: id, readingId: data.inquiry.readingId, nodeIds: [...data.inquiry.nodeIds] };
    setBranchBusy(true); setBranchError('');
    try {
      const inquiry = inquiryDocSchema.parse(await inquiryRequest(api.post('/api/inquiries', branchAttempt.current)));
      navigate(`/inquiry/${inquiry.id}`);
    } catch { setBranchError('The branch was not confirmed. Your question and original inquiry are still here. Retry to check or save it.'); }
    finally { setBranchBusy(false); }
  }
  if (!data || !pack) return <main className="inquiry-page"><Link to="/">Back to your practice</Link>{loadError ? <div role="alert"><p>{loadError}</p><button className="btn-quiet" onClick={() => setAttempt((n) => n + 1)}>Retry inquiry</button></div> : <p role="status">Opening this inquiry…</p>}</main>;
  const { inquiry } = data;
  const reading = pack.readings.find((r) => r.id === inquiry.readingId);
  const suggestedNode = pack.nodes.find((n) => n.id === params.get('node'));
  const mapNode = suggestedNode ?? pack.nodes.find((n) => n.id === params.get('mapNode'));
  return <main className="inquiry-page">
    <nav className="inquiry-breadcrumbs" aria-label="Inquiry navigation"><Link to="/">Your practice</Link>{inquiry.parentId && <Link to={`/inquiry/${inquiry.parentId}`}>Return to the parent question</Link>}</nav>
    {location.state?.readingDraftCleanupFailed && <p role="status">Your inquiry is saved. This browser could not clear the reading draft from this device.</p>}
    <p className="practice-eyebrow">An open inquiry · {inquiry.status}</p><h1 className="inquiry-title">{inquiry.question}</h1>
    <p className="practice-intro">Stay with this question, let it change, or follow something unexpected. There is no deadline and no required conclusion.</p>
    <div className="inquiry-actions">
      {reading && <Link className="btn-quiet" to={libraryHref(`/read/${encodeURIComponent(reading.id)}`, id, mapNode?.id)}>Return to the reading</Link>}
      <Link className="btn-quiet" to={libraryHref('/philosophy', id, mapNode?.id)}>Explore a philosophical connection</Link>
      {inquiry.status === 'active' ? <button className="btn-quiet" disabled={updating} onClick={() => void update({ status: 'paused' })}>Pause inquiry</button> : <button className="btn-primary" disabled={updating} onClick={() => void update({ status: 'active' })}>Resume inquiry</button>}
      {inquiry.status !== 'resting' && <button className="btn-quiet" disabled={updating} onClick={() => void update({ status: 'resting' })}>Let it rest</button>}
    </div>
    {inquiry.status !== 'active' && <p className="save-status">This inquiry is {inquiry.status}. You can still read and write here, or resume whenever you want.</p>}
    <details className="inquiry-adjust"><summary>Let the question evolve</summary><form onSubmit={(e) => { e.preventDefault(); void update({ question: question.trim() }); }}><label htmlFor="inquiry-question">Current question</label><input id="inquiry-question" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} /><button className="btn-quiet" disabled={updating || !question.trim() || question.trim() === inquiry.question}>Save question</button></form><p className="composer-hint">This changes the heading. To keep both questions, create a branch below.</p></details>
    {updateError && <div role="alert" className="save-error"><span>{updateError}</span><button className="btn-quiet" onClick={() => { setAttempt((n) => n + 1); setUpdateError(''); }}>Reload inquiry</button></div>}
    {loadError && <p role="alert">{loadError}</p>}
    {suggestedNode && !inquiry.nodeIds.includes(suggestedNode.id) && <section className="inquiry-connection"><h2>A connection you chose</h2><p><strong>{suggestedNode.title}</strong> — {suggestedNode.summary}</p><button className="btn-quiet" disabled={updating || inquiry.nodeIds.length >= 24} onClick={() => void update({ nodeIds: [...inquiry.nodeIds, suggestedNode.id] })}>Keep this connection</button><p className="composer-hint">A personal association, not a claim that this tradition agrees with you.</p></section>}
    {inquiry.nodeIds.length > 0 && <div className="inquiry-concepts" aria-label="Your philosophical connections">{inquiry.nodeIds.map((nodeId) => <Link key={nodeId} to={libraryHref('/philosophy', id, nodeId)}>{pack.nodes.find((n) => n.id === nodeId)?.title ?? nodeId}</Link>)}</div>}
    <InquiryEditor user={user} inquiryId={id} data={data} pack={pack} onSaved={(writing) => setData((d) => d ? { ...d, writings: d.writings.some((w) => w.id === writing.id) ? d.writings : [...d.writings, writing] } : d)} />
    <section className="inquiry-branch" aria-labelledby="branch-heading"><p className="practice-eyebrow">Make room for an unexpected thought</p><h2 id="branch-heading">Follow a different question</h2><p>A branch keeps this inquiry and its writing intact. It does not have to relate to research, or return to where you started.</p><form onSubmit={(e) => { e.preventDefault(); void createBranch(); }}><label htmlFor="branch-question">The question I want to follow</label><input id="branch-question" value={branch} maxLength={300} onChange={(e) => setBranch(e.target.value)} placeholder="What does this bring up for me?" /><button className="btn-quiet" disabled={branchBusy || !branch.trim()}>{branchBusy ? 'Opening branch…' : 'Follow this question'}</button></form>{branchError && <p role="alert">{branchError}</p>}
      {data.branches.length > 0 && <><h3>Questions that grew from here</h3><ul>{data.branches.map((q) => <li key={q.id}><Link to={`/inquiry/${q.id}`}>{q.question}</Link></li>)}</ul></>}
    </section>
  </main>;
}

const guidance: Record<WritingMode, { title: string; prompt: string; checks: string[] }> = {
  reflection: { title: 'Begin with a particular experience', prompt: 'What distinction in the reading feels unresolved in your own experience?', checks: ['Describe one moment before explaining it.', 'What is your interpretation, and what remains uncertain?', 'What did the reading help you notice—not merely agree with?'] },
  argument: { title: 'Give your thought something to answer to', prompt: 'What do you think is true, why, and what would a thoughtful opponent say?', checks: ['State one claim and define its key term.', 'Give a reason—not just an example or an authority.', 'Represent the strongest objection fairly.', 'Say what evidence or argument would change your mind.'] },
  revision: { title: 'Change the claim, not just the phrasing', prompt: 'What should become more precise after considering an objection?', checks: ['Locate the step your objection challenges.', 'Qualify, defend, or abandon that step.', 'Explain why the revised position is better.', 'Your earlier writing stays saved alongside this version.'] },
  question: { title: 'A better question is worthwhile work', prompt: 'What can you now distinguish that you could not distinguish before?', checks: ['Name what you understand and what you still cannot explain.', 'Separate a factual uncertainty from a disagreement about values.', 'Choose one question to carry, without forcing an answer.'] },
};
function InquiryEditor({ user, inquiryId, data, pack, onSaved }: { user: User; inquiryId: string; data: InquiryDetail; pack: PhilosophyPack; onSaved: (writing: InquiryWriting) => void }) {
  const [initial] = useState(() => {
    try { return { draft: readInquiryDraft(user.uid, inquiryId) ?? freshInquiryDraft(), error: '' }; }
    catch { return { draft: freshInquiryDraft(), error: 'Device draft storage could not be read. Download your writing before leaving this page.' }; }
  });
  const [draft, setDraft] = useState(initial.draft);
  const current = useRef(draft);
  // A recovered ID may have committed before its response was lost.
  const submitted = useRef<InquiryDraft | null>(initial.draft);
  const [storageError, setStorageError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [copying, setCopying] = useState<string | null>(null);
  const [copiedEntries, setCopiedEntries] = useState(() => new Map<string, string>());
  const [copyError, setCopyError] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) { if (storageError && current.current.bodyMd.trim()) e.preventDefault(); }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [storageError]);
  function change(values: Partial<InquiryDraft>) {
    const next = { ...current.current, ...values, updatedAt: new Date().toISOString() };
    if (submitted.current?.id === next.id) next.id = crypto.randomUUID();
    current.current = next; setDraft(next); setNote('');
    try { writeInquiryDraft(user.uid, inquiryId, next); setStorageError(''); }
    catch { setStorageError('Your draft could not be stored on this device. Keep this page open or download your writing.'); }
  }
  async function save() {
    const snapshot = { ...current.current };
    if (!snapshot.bodyMd.trim() || busy || byteLength(snapshot.bodyMd.trim()) > 20 * 1024 || (snapshot.mode === 'revision' && !snapshot.revisesId)) return;
    submitted.current = snapshot; setBusy(true); setError(''); setNote('');
    try {
      const writing = inquiryWritingSchema.parse(await inquiryRequest(api.post(`/api/inquiries/${inquiryId}/writings`, {
        id: snapshot.id, bodyMd: snapshot.bodyMd, mode: snapshot.mode, revisesId: snapshot.revisesId, sourceNodeId: snapshot.sourceNodeId,
      })));
      if (!mounted.current) return;
      onSaved(writing);
      if (current.current.id === snapshot.id) {
        const empty = freshInquiryDraft(); current.current = empty; setDraft(empty);
        try { removeInquiryDraft(user.uid, inquiryId); setStorageError(''); }
        catch { setStorageError('Saved to your account, but the old device draft could not be cleared.'); }
      }
      setNote('Saved to your inquiry. Nothing was sent to AI. Keep exploring, revise, or finish for now.');
    } catch { if (mounted.current) setError('The save could not be confirmed. Your draft is still here. Retry the unchanged draft to check or save it without duplicating it.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  function revise(writing: InquiryWriting) {
    if (current.current.bodyMd.trim()) { setError('There is already a draft here. Save it before starting a revision; it has not been replaced.'); editor.current?.focus(); return; }
    change({ id: crypto.randomUUID(), bodyMd: writing.bodyMd, mode: 'revision', revisesId: writing.id, sourceNodeId: writing.sourceNodeId });
    editor.current?.focus();
  }
  async function copy(writing: InquiryWriting) {
    if (copying) return;
    setCopying(writing.id); setCopyError('');
    try {
      const { entryId } = await inquiryRequest(api.post<{ entryId: string }>(`/api/inquiries/${inquiryId}/writings/${writing.id}/notebook`));
      if (typeof entryId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entryId)) throw new Error('Missing Notebook entry ID');
      if (mounted.current) setCopiedEntries((entries) => new Map(entries).set(writing.id, entryId));
    } catch { if (mounted.current) setCopyError('The Notebook copy was not confirmed. Your inquiry writing is safe; retry to check or copy it.'); }
    finally { if (mounted.current) setCopying(null); }
  }
  const reading = pack.readings.find((r) => r.id === data.inquiry.readingId);
  const guide = guidance[draft.mode];
  const sourcePrompt = reading && draft.mode !== 'question' ? reading.prompts[draft.mode] : null;
  const tooLong = byteLength(draft.bodyMd.trim()) > 20 * 1024;
  const wordCount = draft.bodyMd.trim() ? draft.bodyMd.trim().split(/\s+/u).length : 0;
  return <>
    <section className="inquiry-workshop" aria-labelledby="workshop-heading"><h2 id="workshop-heading">Make the thought your own</h2>
      <div className="writing-modes" role="group" aria-label="Writing approach">{writingModes.map((mode) => <button key={mode} className={`btn-quiet${draft.mode === mode ? ' selected' : ''}`} aria-pressed={draft.mode === mode} onClick={() => change({ mode, revisesId: mode === 'revision' ? draft.revisesId : null })}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>)}</div>
      <div className="writing-guidance"><h3>{guide.title}</h3><p>{sourcePrompt ?? guide.prompt}</p><details><summary>Some footholds, if useful</summary><ul>{guide.checks.map((check) => <li key={check}>{check}</li>)}</ul><p>These are writing prompts, not AI feedback or a test. Disagree with the reading, change the question, or write in your own form.</p></details></div>
      {draft.mode === 'revision' && !draft.revisesId && <label className="revision-source">Choose a saved piece to revise<select aria-label="Earlier piece to revise" value="" onChange={(e) => change({ revisesId: e.target.value || null })}><option value="">Select an earlier piece</option>{data.writings.map((w, index) => <option key={w.id} value={w.id}>{index + 1} · {w.mode} · {w.bodyMd.slice(0, 60)}</option>)}</select>{data.writings.length === 0 && <span>Save a reflection or argument first, then return to it.</span>}</label>}
      {draft.revisesId && <p className="save-status">Revising a saved piece. The original will not be overwritten. <a href={`#writing-${draft.revisesId}`}>Read the original</a></p>}
      <label className="inquiry-editor-label" htmlFor="inquiry-writing">Your writing</label>
      <textarea id="inquiry-writing" ref={editor} value={draft.bodyMd} onChange={(e) => change({ bodyMd: e.target.value })} placeholder="A moment, a distinction, a claim, or something you are not yet sure how to say…" />
      <div className="inquiry-editor-bar"><span>{wordCount} {wordCount === 1 ? 'word' : 'words'} · {tooLong ? 'over the 20 KB limit' : 'your own pace'}</span><button className="btn-primary" disabled={busy || !draft.bodyMd.trim() || tooLong || (draft.mode === 'revision' && !draft.revisesId)} onClick={() => void save()}>{busy ? 'Saving writing…' : 'Save writing'}</button></div>
      <p className="composer-hint">Unsaved drafts stay on this device while signed in. Save to keep them in your account; sign-out clears device drafts. Inquiry writing is not read by AI or weekly correspondents.</p>
      <button className="btn-quiet" disabled={!draft.bodyMd.trim()} onClick={() => downloadWriting(draft.bodyMd)}>Download this draft</button>
      {storageError && <p className="save-error" role="alert">{storageError}</p>}{error && <p className="save-error" role="alert">{error}</p>}{note && <p className="save-status" role="status">{note}</p>}
    </section>
    <section className="inquiry-writing-history" aria-labelledby="saved-writing"><h2 id="saved-writing">The thought as it develops</h2>{data.writings.length === 0 && <p className="page-sub">Your saved reflections, questions, arguments, and revisions will stay together here.</p>}
      {data.writings.map((writing, index) => <article className="inquiry-writing" id={`writing-${writing.id}`} key={writing.id}><p className="practice-eyebrow">{index + 1} · {writing.mode} · {new Date(writing.createdAt).toLocaleDateString()}</p>
        {writing.revisesId && <p><a href={`#writing-${writing.revisesId}`}>Revision of an earlier piece</a></p>}
        <div className="letter-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(writing.bodyMd) }} />
        <div className="inquiry-actions"><button className="btn-quiet" onClick={() => revise(writing)}>Revise this piece</button><button className="btn-quiet" onClick={() => downloadWriting(writing.bodyMd)}>Download piece</button></div>
        <details className="inquiry-copy"><summary>Optional: take this piece to the Notebook</summary><p>This copies only this piece, not the whole inquiry. It does not request AI. In the Notebook you can separately invite a reflection; if weekly letters are enabled, the copied entry can be included in them.</p>{byteLength(writing.bodyMd) > 10 * 1024 ? <p>The Notebook limit is 10 KB. This piece is longer; download it or create a shorter version. Nothing will be truncated.</p> : <button className="btn-quiet" disabled={!!copying} onClick={() => void copy(writing)}>{copying === writing.id ? 'Copying…' : 'Copy this piece to Notebook'}</button>}
          {copiedEntries.has(writing.id) && <p role="status">Copied to Notebook. <Link to={`/notebook?entry=${copiedEntries.get(writing.id)}`}>Open the copied entry</Link></p>}
        </details>
      </article>)}
      {copyError && <p role="alert">{copyError}</p>}
    </section>
  </>;
}
