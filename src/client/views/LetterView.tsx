import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { letterLoadCopy, letterOpenCopy, replyCopy } from '../lib/copy';
import { renderMarkdown } from '../lib/markdown';
import type { EntryDoc, GroundingRef, LetterBundle, ReplyDoc } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';

const SCAFFOLDS: Record<string, string> = {
  director: 'Structure only — the words stay yours: acknowledge the exercise → say honestly what happened when you tried it → ask one question about the theme.',
  future_self: 'Structure only — the words stay yours: say what resonated → name the pattern you recognize in yourself → ask what that future still remembers about now.',
  foreign: 'Structure only — the words stay yours: pick the one connection that mattered → say why, in your own terms → ask where to look next.',
};

export default function LetterView() {
  const { id } = useParams();
  const [bundle, setBundle] = useState<LetterBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [scaffold, setScaffold] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await api.get<LetterBundle>(`/api/letters/${id}`);
      setBundle(b);
      if (b.status === 'sealed') {
        try {
          await api.post(`/api/letters/${id}/open`);
        } catch (e) {
          setError(letterOpenCopy(e)); // non-fatal — reading is unaffected
        }
      }
    } catch (e) {
      setError(letterLoadCopy(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply() {
    if (!reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/api/letters/${id}/reply`, { bodyMd: reply.trim() });
      setReply('');
      await load();
    } catch (e) {
      setError(replyCopy(e)); // the draft stays in the box — nothing lost
    } finally {
      setSending(false);
    }
  }

  if (error && !bundle) return <div className="save-error">{error}</div>;
  if (!bundle) return <p className="empty-note">Unsealing…</p>;

  const card = CORRESPONDENT_CARDS[bundle.cid];
  const concluded = bundle.correspondent.status === 'concluded';

  return (
    <div className="letter-page">
      <div className="letter-head">
        <div className="correspondent">{bundle.reflection ? 'Lucilio reflection' : card?.name ?? bundle.cid}</div>
        <div className="date">
          {new Date(bundle.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}
          <span className="genre-badge">{bundle.reflection?.preferences.depth ?? bundle.genre}</span>
        </div>
      </div>

      <div className="letter-sheet">
        <p className="letter-salutation">{bundle.salutation}</p>
        <LetterBody
          bodyMd={bundle.bodyMd}
          groundingRefs={bundle.groundingRefs}
          sourceEntries={bundle.sourceEntries}
          sourceReplies={bundle.sourceReplies}
        />
        {bundle.extrapolationNote && (
          <div className="extrapolation-note">
            <strong>How to read this letter: </strong>
            {bundle.extrapolationNote}
          </div>
        )}
      </div>

      {error && <div className="save-error" style={{ marginTop: 18 }}>{error}</div>}

      <div className="replies">
        {bundle.replies.map((r) => (
          <div className="reply-item" key={r.id}>
            <div className="when">
              YOUR REPLY · {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div>{r.bodyMd}</div>
          </div>
        ))}

        {bundle.reflection ? (
          <p className="empty-note">This reflection reads only its selected entry. You can disagree with it or leave it here. <Link to="/notebook">Return to your journal</Link>.</p>
        ) : concluded ? (
          <p className="empty-note">
            This correspondence has concluded; the volume is bound. <Link to={`/correspondents/${bundle.cid}`}>Read it in Correspondents</Link>.
          </p>
        ) : (
          <div className="reply-box">
            <label className="scaffold-toggle">
              <input type="checkbox" checked={scaffold} onChange={(e) => setScaffold(e.target.checked)} />
              show a genre scaffold (structural hints only — never words for you)
            </label>
            {scaffold && <div className="scaffold-hints">{SCAFFOLDS[bundle.cid]}</div>}
            <textarea
              style={{ marginTop: 10 }}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Reply to ${card?.name ?? 'your correspondent'}…`}
            />
            <div className="reply-actions">
              <button className="btn-primary" onClick={sendReply} disabled={sending || !reply.trim()}>
                {sending ? 'Sending…' : 'Send reply'}
              </button>
              <span className="composer-hint">Your correspondent reads replies before its next letter.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Renders sanitized markdown, then wraps quoted phrases in grounding spans.
// Hovering a phrase shows which notebook entry or reply it came from (US-4).
function LetterBody({
  bodyMd,
  groundingRefs,
  sourceEntries,
  sourceReplies,
}: {
  bodyMd: string;
  groundingRefs: GroundingRef[];
  sourceEntries: EntryDoc[];
  sourceReplies: ReplyDoc[];
}) {
  const html = useMemo(() => renderMarkdown(bodyMd), [bodyMd]);
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; date: string; excerpt: string } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html; // sanitized by renderMarkdown — the only door

    // Wrap the first occurrence of each quoted phrase in a text node
    // (case-insensitive — models sometimes shift casing when quoting back).
    const phrases = [...groundingRefs].sort((a, b) => b.quotedPhrase.length - a.quotedPhrase.length);
    for (const g of phrases) {
      const needle = g.quotedPhrase.toLowerCase();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('.ground-ref')) continue;
        const idx = node.textContent?.toLowerCase().indexOf(needle) ?? -1;
        if (idx >= 0 && node.textContent) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + g.quotedPhrase.length);
          const span = document.createElement('span');
          span.className = 'ground-ref';
          if (g.entryId) span.dataset.citeEntry = g.entryId;
          if (g.replyId) span.dataset.citeReply = g.replyId;
          range.surroundContents(span);
          break;
        }
      }
    }

    function over(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest?.('.ground-ref') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const containerRect = el!.getBoundingClientRect();
      const base = { x: rect.left - containerRect.left, y: rect.bottom - containerRect.top + 8 };
      const entryId = target.dataset.citeEntry;
      if (entryId) {
        const entry = sourceEntries.find((s) => s.id === entryId);
        const g = groundingRefs.find((x) => x.entryId === entryId);
        const date = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        setTip({
          ...base,
          date: entry
            ? `From your entry of ${date(entry.createdAt)}`
            : g?.entryDate
              ? `From your entry of ${date(g.entryDate)}`
              : 'From your notebook',
          excerpt: entry ? entry.bodyMd.slice(0, 160) + (entry.bodyMd.length > 160 ? '…' : '') : '',
        });
        return;
      }
      const replyId = target.dataset.citeReply;
      if (replyId) {
        const reply = sourceReplies.find((s) => s.id === replyId);
        setTip({
          ...base,
          date: reply
            ? `From your reply of ${new Date(reply.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
            : 'From your reply',
          excerpt: reply ? reply.bodyMd.slice(0, 160) + (reply.bodyMd.length > 160 ? '…' : '') : '',
        });
      }
    }
    function out(e: MouseEvent) {
      if ((e.target as HTMLElement).closest?.('.ground-ref')) setTip(null);
    }
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseout', out);
    return () => {
      el.removeEventListener('mouseover', over);
      el.removeEventListener('mouseout', out);
    };
  }, [html, groundingRefs, sourceEntries, sourceReplies]);

  return (
    <div style={{ position: 'relative' }}>
      <div className="letter-body" ref={ref} />
      {tip && (
        <div className="ground-tip" style={{ left: Math.max(0, Math.min(tip.x, 300)), top: tip.y }}>
          <span className="tip-label">{tip.date}</span>
          {tip.excerpt}
        </div>
      )}
    </div>
  );
}
