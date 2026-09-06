import { Link } from 'react-router-dom';

// The story behind the product, in the same words as the public write-up:
// where the idea came from, what the app is, and what it deliberately is not.
// Rendered inside the shell for signed-in readers and standalone for visitors.
export default function About({ standalone = false }: { standalone?: boolean }) {
  const body = (
    <>
      <h2 className="page-title">About Lucilio</h2>
      <p className="page-sub">A journal that reflects when you invite it.</p>

      <section className="about-section">
        <h3>Where the name comes from</h3>
        <p>
          Lucilio takes its name from Lucilius, the friend Seneca wrote to over the last years of his life.
          Those letters were not advice columns. They were one person writing to another, at a distance,
          about what he had noticed that week: ambition, crowds, a ruined old villa and what luxury does to
          character. The distance was the point. You say more, and more honestly, in a letter than in a
          conversation where the other person is waiting for you to finish your sentence.
        </p>
        <p>
          That is the shape this app borrows. Not a chat window. A letter, written after reading, arriving
          when it is ready.
        </p>
      </section>

      <section className="about-section">
        <h3>Why it exists</h3>
        <p>
          AI is very good at making a task go faster. It is not automatically good at leaving you sure of
          what was yours. Lucilio is built for the second problem. You write in your own words. Nothing is
          sent to a model until you ask. When you do ask, you choose how deep the response goes, and
          whether it may respectfully challenge you.
        </p>
        <p>
          Two ideas shaped the design, and both are motivations rather than promises: writing an account
          of your experience for a reader gives some of the benefit of stepping outside yourself, and
          waiting for a considered reply can be worth more than an instant one. So there is no chat, no
          feed, no streaks. A week unused is not a failure.
        </p>
      </section>

      <section className="about-section">
        <h3>Not a typical journaling app</h3>
        <p>
          People have written to understand themselves for a very long time, and the form was never a chat.
          Seneca advised a nightly review of the day, asking what fault was mended and what remained. Marcus
          Aurelius wrote the Meditations to himself, in a notebook never meant to be read. Epicurus and Seneca
          taught through letters, because a letter makes you set your thoughts in order for someone who is not
          in the room. Montaigne turned the practice into the essay. In every case the writing came first, the
          judgment came later, and the person doing the judging was, in the end, the writer.
        </p>
        <p>
          That is what a chat box under a journal entry gets wrong. It answers before you have finished
          thinking, it answers from outside your own words, and it never has to wait. Lucilio keeps the old
          shape and gives it a modern correspondent.
        </p>
        <ul>
          <li>
            <strong>Writing comes first.</strong> Saving an entry sends it nowhere. A model reads it only when
            you press Reflect on this, and at the depth you choose, from a gentle observation to a
            philosophical question, with challenge only if you invite it.
          </li>
          <li>
            <strong>The reply must be grounded in you.</strong> Every reflection has to quote your own
            phrases, and the server verifies those quotes against your entry before you see it. A second
            review reads it against a written safety rubric. It is an instrument for your thinking, not a
            verdict on it.
          </li>
          <li>
            <strong>Distance is kept on purpose.</strong> No chat, no feed, no streaks, no notifications.
            Weekly letters arrive on a post day, after reading, the way a letter always has, and a
            correspondence can be ended deliberately and kept as a bound volume.
          </li>
          <li>
            <strong>It looks outward as well as inward.</strong> The Stoics went to the wider world for their
            examples. The Atlas offers sourced places and works to write from, so reflection has somewhere
            to go besides the self.
          </li>
          <li>
            <strong>Your words stay yours.</strong> Export everything, delete everything, and read the Trust
            Center for evidence rather than a promise.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>What you will find here</h3>
        <ul>
          <li>
            <strong>The Notebook.</strong> Write and save with no AI involved. Invite a reflection on any
            entry when you want one, at the depth you choose.
          </li>
          <li>
            <strong>Correspondents.</strong> Three optional voices who each write one considered letter on
            a shared weekly post day. Every correspondence can be ended on purpose and kept as a bound
            volume.
          </li>
          <li>
            <strong>The Atlas.</strong> A small, curated set of places and works with sourced essays, and a
            way to carry one back into your Notebook as a starting line.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>How your words are treated</h3>
        <p>
          Every reflection must quote your own entries, and a second review checks each one against a
          written safety rubric before you see it. Your writing is stored under your account alone, you can
          export all of it, and you can delete everything. Reflections can be wrong; they are an instrument
          for your thinking, not a verdict on it.{' '}
          {standalone
            ? 'The Trust Center, available once you sign in, shows the evidence behind these claims.'
            : <>The <Link to="/trust">Trust Center</Link> shows the evidence behind these claims.</>}
        </p>
      </section>

      <section className="about-section">
        <h3>Built on Google Cloud</h3>
        <p>
          Lucilio runs as one Cloud Run service behind Firebase Hosting, signs you in with Firebase
          Authentication, keeps your notebook in Cloud Firestore under owner-only rules, writes reflections
          with Gemini through Google AI Studio, and holds its keys in Secret Manager. The sealed-letter
          mark and the visual identity were generated with Gemini as well. The code is public at{' '}
          <a href="https://github.com/sammatuba/lucilio" target="_blank" rel="noreferrer">github.com/sammatuba/lucilio</a>.
        </p>
      </section>
    </>
  );

  if (!standalone) return body;
  return (
    <div className="landing">
      <div className="card about-card">
        {body}
        <p style={{ marginTop: 24 }}>
          <Link to="/">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
