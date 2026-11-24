import { Link } from 'react-router-dom';
import { PhilosophyPackStatus, usePhilosophyPack } from '../components/PhilosophySources';
import ReadingSketch from '../components/ReadingSketch';

const collections = [
  { title: 'Essays', to: '/explore/essays', description: 'Begin with an ordinary moment and follow the question it raises.' },
  { title: 'Philosophy Map', to: '/philosophy', description: 'Trace a question across thinkers, traditions, and their sources.' },
  { title: 'Atlas', to: '/atlas', description: 'Visit a place, a work, or a life. Each plate leaves you with a question to carry.' },
];

export default function Explore() {
  return (
    <main>
      <h1 className="page-title">Explore</h1>
      <ul className="atlas-ledger explore-collections">
        {collections.map(({ title, to, description }, index) => (
          <li key={to}>
            <Link to={to} className="atlas-ledger-row" aria-label={title} aria-describedby={`collection-description-${index}`}>
              <span className="atlas-title">{title}</span>
              <span id={`collection-description-${index}`} className="atlas-standfirst">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function Essays() {
  const { pack, state, retry } = usePhilosophyPack();
  return (
    <main>
      <nav className="inquiry-breadcrumbs" aria-label="Essay collection navigation"><Link to="/explore">Explore</Link></nav>
      <h1 className="page-title">Essays</h1>
      {state !== 'ready' && <PhilosophyPackStatus state={state} retry={retry} />}
      {pack && <ol className="atlas-ledger essay-contents">
        {pack.readings.map((reading) => (
          <li key={reading.id}>
            <Link to={`/read/${reading.id}`} className="atlas-ledger-row">
              <ReadingSketch id={reading.id} lazy />
              <span className="atlas-main">
                <span className="atlas-title">{reading.title}</span>
                <span className="atlas-standfirst">{reading.standfirst}</span>
                <span className="composer-hint">{reading.minutes} min</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>}
    </main>
  );
}
