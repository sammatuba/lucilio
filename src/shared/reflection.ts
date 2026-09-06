import type { ReflectionPreferences } from './schemas.js';
export const REFLECTION_VERSION = 'reflection-v1.0.0';

export const DEPTH_COPY = {
  gentle: { label: 'Gentle', description: 'A small observation and an optional question. Everyday moments can stay simple.', example: 'What part of doing the work yourself did you miss?' },
  reflective: { label: 'Reflective', description: 'Explore feelings, values, and possible patterns without jumping to conclusions.', example: 'Which mattered more here: the result or the feeling of competence?' },
  exploratory: { label: 'Exploratory', description: 'Consider another perspective and examine what matters to you.', example: 'What would you preserve: the process, the result, or the recognition?' },
  philosophical: { label: 'Philosophical', description: 'Explore meaning, identity, knowledge, and agency through your own experience.', example: 'What makes the work yours: execution, judgment, intention, or responsibility?' },
} as const;

export const INTEREST_LABELS = {
  everyday_life: 'Everyday life', relationships: 'Relationships', creativity: 'Creativity',
  philosophy: 'Philosophy', ai: 'Technology and AI',
} as const;

// Only validated enums and booleans enter this instruction, never journal text.
export function reflectionInstruction(p: ReflectionPreferences): string {
  return `Write a reflection on the selected entry. Depth: ${DEPTH_COPY[p.depth].label}.
${DEPTH_COPY[p.depth].description}
Gentle reflections should usually be 60-120 words; other depths 100-250 words. Depth is not length.
Offer at most one optional question. Do not force a lesson, exercise, or existential meaning.
Treat interpretations as tentative. The user may disagree, leave, or simply save their writing.
${p.challenge ? 'The user invites respectful examination of assumptions; stay tentative.' : 'The user has not invited challenge: be curious and gentle, never confrontational.'}
Optional interests: ${p.interests.map((i) => INTEREST_LABELS[i]).join(', ') || 'none selected'}.
Use interests only when the entry makes them relevant. Never force AI or philosophy into an ordinary moment.
You have no live research or external verification tool. Do not claim current knowledge or invent citations, quotations, or historical facts. Offer an optional direction for inquiry when appropriate.
Keep entry identifiers only in groundingRefs, never in prose. Use actual paragraph breaks, not literal backslash-n text.
Sign off as Lucilio. You are an AI reflection tool, not a person or an authority on the user's identity.`;
}
