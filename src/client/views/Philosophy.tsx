import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { libraryHref, linkedInquiry, returnToInquiry } from '../lib/inquiryNavigation';
import type { PhilosophyNode, PhilosophyPack } from '../../shared/philosophy';
import PhilosophySources, { PhilosophyMarkdown, PhilosophyPackStatus, usePhilosophyPack } from '../components/PhilosophySources';

export default function Philosophy() {
  const { pack, state, retry } = usePhilosophyPack();
  return (
    <section className="philosophy-page" aria-labelledby="philosophy-title">
      <Link to="/explore">Back to Explore</Link>
      <header className="philosophy-header illustrated-header">
        <div>
          <p className="philosophy-eyebrow">An open library</p>
          <h1 id="philosophy-title">The philosophy map</h1>
          <p>Follow a question, meet another tradition, or find a position that challenges your own.
            Every entry is available; nothing is hidden by your interests.</p>
        </div>
        <img src="/folded-map.webp" width="560" height="280" alt="" />
      </header>
      {state !== 'ready' ? <PhilosophyPackStatus state={state} retry={retry} />
        : pack && <PhilosophyMap pack={pack} />}
    </section>
  );
}

function PhilosophyMap({ pack }: { pack: PhilosophyPack }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const area = params.get('area') ?? '';
  const nodeId = params.get('node');
  const inquiryParam = params.get('inquiry');
  const inquiryId = linkedInquiry(params);
  const areas = [...new Set(pack.nodes.map((node) => node.area))].sort();
  const query = search.trim().toLocaleLowerCase();
  const visible = pack.nodes.filter((node) => (!area || node.area === area)
    && [node.title, node.area, node.kind, node.summary, node.detailMd, ...node.questions]
      .join(' ').toLocaleLowerCase().includes(query));
  const selected = nodeId !== null ? pack.nodes.find((node) => node.id === nodeId) : visible[0];
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const previousNodeId = useRef(nodeId);
  useEffect(() => {
    // Search changes must not steal focus from the form controls.
    if (previousNodeId.current !== nodeId) {
      previousNodeId.current = nodeId;
      selectedHeading.current?.focus();
    }
  }, [nodeId]);

  function setFilter(key: 'q' | 'area', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    next.delete('q');
    next.delete('area');
    setParams(next, { replace: true });
  }
  function nodeHref(id: string) {
    const next = new URLSearchParams(params);
    next.set('node', id);
    return `/philosophy?${next.toString()}`;
  }

  return (
    <>
      {inquiryId && (
        <aside className="philosophy-context" aria-label="Your inquiry context">
          <Link to={returnToInquiry(inquiryId, selected?.id)}>Back to your inquiry</Link>
          <p>Explore freely. Selecting a node here does not attach it or change your inquiry.</p>
          {selected && (
            <Link to={`${returnToInquiry(inquiryId)}?${new URLSearchParams({ node: selected.id })}`}>
              Consider “{selected.title}” for your inquiry
            </Link>
          )}
        </aside>
      )}
      {inquiryParam !== null && !inquiryId && (
        <p className="philosophy-state" role="alert">This inquiry link is not valid. You can still browse the whole map.</p>
      )}
      <details className="philosophy-coverage" open>
        <summary>Editorial scope &amp; coverage</summary>
        <p>{pack.coverageNote}</p>
        <p>Pack {pack.version}. These are source-guided editorial orientations, not primary texts or a complete history.
          Compare the cited sources and their contexts.</p>
      </details>

      <section className="philosophy-browser" aria-labelledby="philosophy-browse-title">
        <h2 id="philosophy-browse-title">Browse every entry</h2>
        <div className="philosophy-filters">
          <div>
            <label htmlFor="philosophy-search">Search the map</label>
            <input id="philosophy-search" type="search" value={search} placeholder="A tradition, idea, or question"
              onChange={(event) => setFilter('q', event.target.value)} />
          </div>
          <div>
            <label htmlFor="philosophy-area">Area</label>
            <select id="philosophy-area" value={area} onChange={(event) => setFilter('area', event.target.value)}>
              <option value="">All areas</option>
              {area && !areas.includes(area) && <option value={area}>Unknown area</option>}
              {areas.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          {(search || area) && <button className="philosophy-button" type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
        {area && !areas.includes(area) && <p role="alert">That area is not in this edition. Choose another area or clear the filters.</p>}
        <p className="philosophy-meta" role="status">{visible.length} of {pack.nodes.length} entries shown</p>
        {selected && <a href="#philosophy-selected-title">Skip to the selected entry</a>}
        {!visible.length && <p>No entries match these filters. Try another question or clear the filters.</p>}
        <ul className="philosophy-index" aria-label="Map entries">
          {visible.map((node) => (
            <li key={node.id}>
              <Link to={nodeHref(node.id)} aria-current={selected?.id === node.id ? 'true' : undefined}>
                <span className="philosophy-meta">{node.area} · {node.kind}</span>
                <span className="philosophy-node-title">{node.title}</span>
                <span className="philosophy-node-summary">{node.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {nodeId !== null && !selected && (
        <div className="philosophy-state" role="alert">
          <h2>That entry is not in this edition</h2>
          <p>Choose any entry above. An unknown link does not limit the rest of the map.</p>
        </div>
      )}
      {selected && (
        <section className="philosophy-detail" aria-labelledby="philosophy-selected-title">
          <p className="philosophy-eyebrow">Selected entry · {selected.area} · {selected.kind}</p>
          <h2 id="philosophy-selected-title" ref={selectedHeading} tabIndex={-1} aria-live="polite">{selected.title}</h2>
          {!visible.some((node) => node.id === selected.id) && (
            <p className="philosophy-meta">This selected entry is outside your current filters. Its connections remain available.</p>
          )}
          <p className="philosophy-lede">{selected.summary}</p>
          <PhilosophyMarkdown>{selected.detailMd}</PhilosophyMarkdown>
          <h3>Questions to keep open</h3>
          <ul>{selected.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
          <h3>Helpful starting points</h3>
          <p className="philosophy-meta">Suggested prerequisites, not requirements. You may begin here.</p>
          {selected.prerequisiteIds.length ? (
            <ul>{selected.prerequisiteIds.map((id) => (
              <li key={id}><Link to={nodeHref(id)}>{pack.nodes.find((node) => node.id === id)?.title}</Link></li>
            ))}</ul>
          ) : <p>No prerequisite reading is needed.</p>}
          <h3>Read further</h3>
          {selected.readingIds.length ? (
            <ul>{selected.readingIds.map((id) => (
              <li key={id}><Link to={libraryHref(`/read/${encodeURIComponent(id)}`, inquiryId, selected.id)}>{pack.readings.find((reading) => reading.id === id)?.title}</Link></li>
            ))}</ul>
          ) : <p>No companion essay in this edition; the sources below offer a way further.</p>}
          <h3>Sources for this entry</h3>
          <p className="philosophy-meta">External sources open in a new tab. Locators identify the relevant part, not necessarily agreement.</p>
          <PhilosophySources sources={pack.sources} sourceIds={selected.sourceIds} />
          <Connections key={selected.id} selected={selected} pack={pack} nodeHref={nodeHref} />
        </section>
      )}
    </>
  );
}

function Connections({ selected, pack, nodeHref }: {
  selected: PhilosophyNode;
  pack: PhilosophyPack;
  nodeHref: (id: string) => string;
}) {
  const [page, setPage] = useState(0);
  const graphId = useId();
  const relations = pack.relations.filter((relation) => relation.from === selected.id || relation.to === selected.id);
  const neighbors = relations.map((relation) => ({
    relation,
    node: pack.nodes.find((node) => node.id === (relation.from === selected.id ? relation.to : relation.from))!,
  }));
  const shown = neighbors.slice(page * 6, page * 6 + 6);
  const positions = [[160, 26], [278, 70], [278, 166], [160, 210], [42, 166], [42, 70]] as const;
  return (
    <section className="philosophy-connections" aria-labelledby={`${graphId}-heading`}>
      <h3 id={`${graphId}-heading`}>Explained connections</h3>
      <p>Connections are editorial comparisons, not claims of equivalence or historical influence.
        Distance and placement in this diagram have no philosophical meaning.</p>
      {!neighbors.length ? <p>No connections are recorded for this entry yet.</p> : (
        <>
          <figure className="philosophy-graph">
            <svg viewBox="0 0 320 236" role="img" aria-labelledby={`${graphId}-title ${graphId}-description`}>
              <title id={`${graphId}-title`}>Connections around {selected.title}</title>
              <desc id={`${graphId}-description`}>
                {shown.map(({ node }, index) => `${page * 6 + index + 1}: ${node.title}`).join('; ')}.
                The numbered links below provide every connection, its meaning, and sources.
              </desc>
              {shown.map(({ node }, index) => {
                const [x, y] = positions[index]!;
                return (
                  <g key={index}>
                    <line x1="160" y1="118" x2={x} y2={y} className="philosophy-graph-line" />
                    <circle cx={x} cy={y} r="20" className="philosophy-graph-neighbor" />
                    <text x={x} y={y + 5} textAnchor="middle" className="philosophy-graph-number">{page * 6 + index + 1}</text>
                    <title>{node.title}</title>
                  </g>
                );
              })}
              <circle cx="160" cy="118" r="40" className="philosophy-graph-center" />
              <text x="160" y="115" textAnchor="middle" className="philosophy-graph-center-text">Selected</text>
              <text x="160" y="133" textAnchor="middle" className="philosophy-graph-center-text">entry</text>
            </svg>
            <figcaption>{selected.title} · {neighbors.length} explained {neighbors.length === 1 ? 'connection' : 'connections'}.
              Numbers match the keyboard-accessible list below.</figcaption>
            {neighbors.length > 6 && (
              <div className="philosophy-graph-pages">
                <button className="philosophy-button" type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous neighbors</button>
                <span role="status">Diagram {page * 6 + 1}–{page * 6 + shown.length} of {neighbors.length}</span>
                <button className="philosophy-button" type="button" disabled={(page + 1) * 6 >= neighbors.length} onClick={() => setPage((value) => value + 1)}>Next neighbors</button>
              </div>
            )}
          </figure>
          <ol className="philosophy-relations" aria-label="All explained connections">
            {neighbors.map(({ node, relation }, index) => (
              <li key={index}>
                <Link to={nodeHref(node.id)}>{node.title}</Link>
                <p className="philosophy-relation-kind">
                  {pack.nodes.find((entry) => entry.id === relation.from)?.title}
                  {' — '}<strong>{relation.kind}</strong>{' — '}
                  {pack.nodes.find((entry) => entry.id === relation.to)?.title}
                </p>
                <p>{relation.explanation}</p>
                <PhilosophySources compact sources={pack.sources} sourceIds={relation.sourceIds} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
