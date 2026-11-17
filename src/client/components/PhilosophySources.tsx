import { useEffect, useMemo, useState } from 'react';
import { philosophyPackSchema, type PhilosophyPack, type PhilosophySource } from '../../shared/philosophy';
import { api } from '../lib/api';
import { inquiryRequest } from '../lib/inquiryDraft';
import { renderMarkdown } from '../lib/markdown';

export function usePhilosophyPack() {
  const [pack, setPack] = useState<PhilosophyPack | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setPack(null);
    setState('loading');
    inquiryRequest(api.get<unknown>('/api/philosophy'))
      .then((data) => {
        const parsed = philosophyPackSchema.parse(data);
        if (active) {
          setPack(parsed);
          setState('ready');
        }
      })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [attempt]);

  return { pack, state, retry: () => setAttempt((value) => value + 1) };
}

export function PhilosophyPackStatus({ state, retry }: {
  state: 'loading' | 'error';
  retry: () => void;
}) {
  if (state === 'loading') {
    return <p className="philosophy-state" role="status">Opening the philosophy library…</p>;
  }
  return (
    <div className="philosophy-state" role="alert">
      <p>The philosophy library could not be opened. Your writing has not been changed.</p>
      <button className="philosophy-button" type="button" onClick={retry}>Try again</button>
    </div>
  );
}

export function PhilosophyMarkdown({ children }: { children: string }) {
  const html = useMemo(() => renderMarkdown(children), [children]);
  return (
    <div
      className="philosophy-prose"
      dangerouslySetInnerHTML={{ __html: html }}
      ref={(element) => {
        // Apply link behavior only after sanitization.
        element?.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
          if (/^https?:/i.test(link.href)) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }
        });
      }}
    />
  );
}

export default function PhilosophySources({ sources, sourceIds, compact = false }: {
  sources: PhilosophySource[];
  sourceIds: string[];
  compact?: boolean;
}) {
  const selected = [...new Set(sourceIds)]
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is PhilosophySource => Boolean(source));
  return (
    <ul className={`philosophy-sources${compact ? ' philosophy-sources-compact' : ''}`} aria-label="Sources and locators">
      {selected.map((source) => (
        <li key={source.id}>
          <span className="philosophy-source-kind">{source.kind === 'primary' ? 'Primary text' : 'Reference'}</span>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}<span className="philosophy-sr-only"> (external source, opens in a new tab)</span>
          </a>
          <span className="philosophy-source-author"> — {source.author}</span>
          <p className="philosophy-locator"><strong>Locator:</strong> {source.locator}</p>
          {!compact && <p className="philosophy-source-note">{source.note}</p>}
        </li>
      ))}
    </ul>
  );
}
