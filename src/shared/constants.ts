// Public-facing correspondent cards (onboarding, Study, Desk). The actual
// persona SYSTEM INSTRUCTIONS live server-side in src/server/personas/ and are
// never shipped to the client.
import type { CorrespondentId } from './schemas.js';

export interface CorrespondentCard {
  cid: CorrespondentId;
  name: string;
  title: string;
  cadence: string;
  selfDescription: string;
}

export const CORRESPONDENT_CARDS: Record<CorrespondentId, CorrespondentCard> = {
  director: {
    cid: 'director',
    name: 'The Director',
    title: 'Practical philosophy, in the tradition of Seneca',
    cadence: 'One letter each week, on the post',
    selfDescription:
      'I read your recent entries and choose one theme from your own words, quoting them back with dates. ' +
      'Then I work that theme into a single concrete exercise you can attempt before I write again — and I ' +
      'follow up honestly on the exercises I have already given. My letters take the classical forms: ' +
      'exhortation, consolation, congratulation, chosen to fit your week. Warm, direct, unhurried, and ' +
      'without flattery. I am an AI instrument for a reflective practice, not a person.',
  },
  future_self: {
    cid: 'future_self',
    name: 'The Future Self',
    title: 'A letter from who your notebook implies you are becoming',
    cadence: 'One letter each week, on the post',
    selfDescription:
      'I write as the person several years from now that your current writing points toward — settled, kind, ' +
      'remembering your present struggles as things once written about. Every forward-looking thing I say ' +
      'traces to a pattern in your own entries, and every letter carries a plain label saying I am an ' +
      'extrapolation from your recent writing, never a prediction of outcomes. I am an AI instrument for a ' +
      'reflective practice, not a person and not a prophecy.',
  },
  foreign: {
    cid: 'foreign',
    name: 'The Foreign Correspondent',
    title: 'Dispatches from the wider world of ideas',
    cadence: 'One letter each week, on the post',
    selfDescription:
      'I send dispatches connecting what you are thinking about to the wider world — books, research fields, ' +
      'historical parallels, crafts, and thinkers you have not mentioned but seem to be circling. At most two ' +
      'or three connections per letter, each tied to something you actually wrote. I date my claims, and I ' +
      'never invent a source. I am an AI instrument for a reflective practice, not a person.',
  },
};

export const PRACTICE_INTRO =
  'A reading-first practice for thinking deeply through philosophy. Encounter an idea, follow your own questions, ' +
  'and develop your thoughts through personal writing and careful argument. ' +
  'Two–three hours across a week, with no deadlines, streaks, or required conclusions. ' +
  'The Notebook and invited AI reflections remain available separately; your interpretation stays yours.';

export const CRISIS_RESOURCES = {
  headline: 'Support is available, and it is okay to reach for it',
  lines: [
    'If you are in distress or thinking about harming yourself, please contact people who can truly help:',
    '• 988 Suicide & Crisis Lifeline — call or text 988 (US), or find your country’s line at findahelpline.com',
    '• International crisis lines: befrienders.org',
  ],
};
