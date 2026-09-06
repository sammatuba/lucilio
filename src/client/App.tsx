import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { onAuthStateChanged, type User } from './lib/auth';
import { auth } from './lib/firebase';
import { api } from './lib/api';
import type { DeskPayload } from '../shared/schemas';
import { CRISIS_RESOURCES } from '../shared/constants';
import Landing from './views/Landing';
import Onboarding from './views/Onboarding';
import LetterView from './views/LetterView';
import Notebook from './views/Notebook';
import Correspondents from './views/Correspondents';
import StudyThread from './views/StudyThread';
import TrustCenter from './views/TrustCenter';
import Atlas from './views/Atlas';
import AtlasPlate from './views/AtlasPlate';
import Settings from './views/Settings';
import AccountMenu from './components/AccountMenu';
import About from './views/About';
import { CompassIcon, NotebookIcon } from './components/icons';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  if (user === undefined) {
    return <div className="landing"><div className="card"><p className="empty-note">Opening the desk…</p></div></div>;
  }
  if (!user) {
    return (
      <Routes>
        <Route path="/about" element={<About standalone />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }
  return <Shell user={user} />;
}

function Shell({ user }: { user: User }) {
  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const location = useLocation();

  async function loadDesk() {
    try {
      setDesk(await api.get<DeskPayload>('/api/desk'));
      setDeskError(null);
    } catch (e) {
      setDeskError(e instanceof Error ? e.message : 'could not reach the desk');
    }
  }

  async function onOnboarded() {
    // Optimistic: the welcome cycle is claimed server-side; reflect it at once
    // so the post-onboarding redirect to the Desk cannot bounce back through
    // /onboarding on a stale desk payload.
    setDesk((d) => (d ? { ...d, profile: { ...d.profile, onboarded: true } } : d));
    await loadDesk();
  }

  useEffect(() => {
    loadDesk();
  }, [user.uid]);

  const onboarding = location.pathname === '/onboarding';

  // Roadmap M2-6: onboarding comes before every surface. Until the desk proves
  // otherwise, each route leads back to it — a new user cannot skip the welcome
  // cycle by way of the nav. While the desk is loading or unreachable we render
  // the route's own loading state instead of guessing.
  function guard(el: ReactElement): ReactElement {
    if (desk && !desk.profile.onboarded && !onboarding) return <Navigate to="/onboarding" replace />;
    return el;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="wordmark" style={{ textDecoration: 'none' }}>
          <img src="/lockup.svg" alt="Lucilio: understand yourself in a changing world" className="brand-lockup" />
          <span className="sr-only">Lucilio</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end aria-label="Notebook"><NotebookIcon /><span className="nav-label">Notebook</span></NavLink>
          <NavLink to="/atlas" aria-label="Atlas"><CompassIcon /><span className="nav-label">Atlas</span></NavLink>
        </nav>
        <AccountMenu user={user} />
      </header>

      {desk?.profile.crisisNotice && (
        <div className="crisis-banner">
          <strong>{CRISIS_RESOURCES.headline}</strong>
          {CRISIS_RESOURCES.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}

      {deskError && (
        <div className="save-error">
          <span>{deskError}</span>
          <button className="btn-quiet" onClick={loadDesk}>Retry</button>
        </div>
      )}

      <Routes>
        <Route path="/" element={guard(<Notebook user={user} desk={desk} refresh={loadDesk} />)} />
        <Route
          path="/onboarding"
          element={desk?.profile.onboarded ? <Navigate to="/" replace /> : <Onboarding user={user} onDone={onOnboarded} />}
        />
        <Route path="/letter/:id" element={guard(<LetterView />)} />
        <Route path="/notebook" element={<Navigate to="/" replace />} />
        <Route path="/desk" element={<Navigate to="/" replace />} />
        <Route path="/correspondents" element={guard(<Correspondents desk={desk} refresh={loadDesk} />)} />
        <Route path="/correspondents/:cid" element={guard(<StudyThread />)} />
        <Route path="/study" element={<Navigate to="/correspondents" replace />} />
        <Route path="/study/:cid" element={<StudyRedirect />} />
        <Route path="/atlas" element={guard(<Atlas />)} />
        <Route path="/atlas/:id" element={guard(<AtlasPlate />)} />
        <Route path="/trust" element={guard(<TrustCenter />)} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={guard(<Settings user={user} />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="footer-note">
        AI reflections can be wrong. Your words remain yours. See the Trust Center for how they are stored and used.
      </footer>
    </div>
  );
}

// The Study was renamed to Correspondents; old links/bookmarks to a specific
// volume still resolve.
function StudyRedirect() {
  const { cid } = useParams();
  return <Navigate to={`/correspondents/${cid}`} replace />;
}
