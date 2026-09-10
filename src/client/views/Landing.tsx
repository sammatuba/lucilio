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
      <div className="card">
        <h1 className="sr-only">Lucilio</h1>
        <img src="/lockup.svg" alt="Lucilio: understand yourself in a changing world" className="landing-lockup" />

        <div className="explainer landing-explainer">
          <p>{PRACTICE_INTRO}</p>
          <ol className="landing-steps">
            <li><strong>Write and save</strong> a moment in your own words — privately.</li>
            <li><strong>Invite a reflection</strong> when you want one; the AI reads only that entry.</li>
            <li><strong>Optional: ask a correspondent</strong> for a weekly letter drawn from several entries.</li>
          </ol>
        </div>

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
