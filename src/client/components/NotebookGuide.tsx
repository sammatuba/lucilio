import { useState } from 'react';

// The Notebook home explains itself. A reader who has just arrived sees the
// three moves of the practice in order — write, invite, optionally ask — and
// then it folds away for readers who already know. It never competes with the
// composer: it is prose, not another row of equal-weight buttons.
export default function NotebookGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="notebook-guide"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>New here? How Lucilio works</summary>
      <ol>
        <li>
          <strong>Write and save.</strong> One sentence is enough, and it stays private until you
          choose to share an entry with the AI.
        </li>
        <li>
          <strong>Invite a reflection when you want one.</strong> The AI reads only that entry and
          offers an interpretation you are free to disagree with.
        </li>
        <li>
          <strong>Optional: ask a correspondent for a letter.</strong> A correspondent writes a
          weekly letter drawn from several entries. Nothing is expected of you here.
        </li>
      </ol>
    </details>
  );
}
