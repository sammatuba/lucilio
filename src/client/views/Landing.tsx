import { useEffect, useState } from 'react';
import { completeRedirectSignIn, devSignIn, signInWithGoogle, useEmulators } from '../lib/auth';
import { signInCopy } from '../lib/copy';
import { Link } from 'react-router-dom';
import { PRACTICE_INTRO } from '../../shared/constants';

export default function Landing() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoName, setDemoName] = useState('');

  // A redirect sign-in returns to this view; success routes away through
  // onAuthStateChanged, failure surfaces through the shared copy map.
  useEffect(() => {
    completeRedirectSignIn().catch((e: unknown) => setError(signInCopy(e)));
  }, []);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(signInCopy(e));
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      await devSignIn(demoName || 'Demo Reader');
    } catch (e) {
      setError(signInCopy(e));
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <div className="card landing-card">
        <h1 className="sr-only">Lucilio</h1>
        <img src="/lockup.svg" width="440" height="128" alt="Lucilio: understand yourself in a changing world" className="landing-lockup" />

        <p className="landing-intro">{PRACTICE_INTRO}</p>

        <ol className="landing-steps" role="list">
          <li>
            <img src="/trust-rim.webp" width="560" height="280" alt="" />
            <p><strong>Read something worth thinking about</strong> — philosophy with sources and competing perspectives.</p>
          </li>
          <li>
            <img src="/folded-map.webp" width="560" height="280" alt="" />
            <p><strong>Follow your own question</strong> through a broad map of ideas, without a prescribed destination.</p>
          </li>
          <li>
            <img src="/correspondence-letter.webp" width="560" height="280" alt="" />
            <p><strong>Write, question, and revise</strong> — personal reflections and arguments, at your own pace.</p>
          </li>
        </ol>

        <button className="btn-primary" onClick={google} disabled={busy}>
          Sign in with Google
        </button>
        {useEmulators && (
          <div className="dev-note">
            <div style={{ marginBottom: 8 }}>emulator mode — demo sign-in (no Google account needed)</div>
            <input
              value={demoName}
              onChange={(e) => setDemoName(e.target.value)}
              placeholder="your name"
            />
            <button className="btn-quiet" onClick={demo} disabled={busy}>Enter as demo reader</button>
          </div>
        )}
        {error && <div className="save-error" style={{ marginTop: 20 }}>{error}</div>}

        <p className="landing-about"><Link to="/about">About Lucilio: where the idea comes from</Link></p>
      </div>
    </div>
  );
}
