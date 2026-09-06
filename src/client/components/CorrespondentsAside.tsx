import { Link } from 'react-router-dom';
import type { DeskPayload } from '../../shared/schemas';
import { CORRESPONDENT_CARDS } from '../../shared/constants';
import RequestLetterButton from './RequestLetterButton';
import { Seal, sealLetter } from './icons';

// Compact correspondents summary for the Notebook home's aside: one row per
// correspondent with the shared ask-to-write affordance, a link out to the
// full Correspondents page (where volumes are read and correspondences end),
// and a card pointing toward the Atlas.
export default function CorrespondentsAside({ desk, refresh }: { desk: DeskPayload | null; refresh: () => void }) {
  const correspondents = desk?.correspondents ?? [];

  return (
    <aside className="desk-aside">
      <h3>Your correspondents</h3>
      {correspondents.map((c) => {
        const card = CORRESPONDENT_CARDS[c.cid];
        const concluded = c.status === 'concluded';
        return (
          <p key={c.cid} style={{ margin: '8px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Seal letter={sealLetter(c.cid)} size={24} />
              <span style={{ display: 'block' }}>{card.name}</span>
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>
              {card.title}
            </span>
            {concluded
              ? <span className="composer-hint">ended</span>
              : desk && <RequestLetterButton cid={c.cid} desk={desk} refresh={refresh} style={{ width: '100%', marginTop: 6 }} />}
          </p>
        );
      })}
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', fontFamily: 'var(--sans)' }}>
        Once per correspondent per day. It takes a few minutes — your correspondent reads before writing.
      </p>
      <p><Link to="/correspondents">All correspondents</Link></p>

      <h3>Explore the Atlas</h3>
      <p>
        Curated places and sources to write from. <Link to="/atlas">Open the Atlas</Link>
      </p>
    </aside>
  );
}
