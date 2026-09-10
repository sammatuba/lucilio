// Shared contracts between server and client. Everything here is plain data +
// zod validation — no firebase imports, safe to bundle into the browser.
import { z } from 'zod';

export const CORRESPONDENT_IDS = ['director', 'future_self', 'foreign'] as const;
export type CorrespondentId = (typeof CORRESPONDENT_IDS)[number];

export const LETTER_GENRES = [
  'hortatoria',
  'consolatoria',
  'gratulatoria',
  'dispatch',
  'welcome',
  'final',
  'resources',
] as const;
export type LetterGenre = (typeof LETTER_GENRES)[number];

export const LETTER_STATUSES = ['sealed', 'opened', 'replied', 'final'] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const REPLY_INTENTS = ['respond', 'request_topic', 'conclude', 'distress_flag'] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

export const REFLECTION_DEPTHS = ['gentle', 'reflective', 'exploratory', 'philosophical'] as const;
export const REFLECTION_INTERESTS = ['everyday_life', 'relationships', 'creativity', 'philosophy', 'ai'] as const;
export const reflectionPreferencesSchema = z.object({
  depth: z.enum(REFLECTION_DEPTHS).default('gentle'),
  interests: z.array(z.enum(REFLECTION_INTERESTS)).max(5).default([]),
  challenge: z.boolean().default(false),
  autoReflect: z.boolean().default(false),
});
export type ReflectionPreferences = z.infer<typeof reflectionPreferencesSchema>;
export const DEFAULT_REFLECTION_PREFERENCES = reflectionPreferencesSchema.parse({});
export const reflectionRequestSchema = z.object({
  entryId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  preferences: reflectionPreferencesSchema,
});
export interface ReflectionSelection {
  entryId: string;
  preferences: ReflectionPreferences;
}
export interface ReflectionResult {
  cycleId?: string;
  state: 'composing' | 'delivered' | 'failed';
  letterId?: string;
}

const MAX_ENTRY_BYTES = 10 * 1024;
export const MAX_LETTER_BYTES = 8 * 1024;
export const MAX_MEMORY_BYTES = 32 * 1024;

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// ---- Requests ----

export const entryCreateSchema = z
  .object({
    bodyMd: z.string().min(1, 'an entry needs words'),
  })
  .refine((v) => byteLength(v.bodyMd) <= MAX_ENTRY_BYTES, {
    message: 'entries are limited to 10 KB',
  });
export type EntryCreate = z.infer<typeof entryCreateSchema>;

export const replyCreateSchema = z
  .object({
    bodyMd: z.string().min(1, 'a reply needs words'),
  })
  .refine((v) => byteLength(v.bodyMd) <= MAX_ENTRY_BYTES, {
    message: 'replies are limited to 10 KB',
  });
export type ReplyCreate = z.infer<typeof replyCreateSchema>;

export const requestLetterSchema = z.object({
  cid: z.enum(CORRESPONDENT_IDS),
});
export type RequestLetter = z.infer<typeof requestLetterSchema>;

export const profileUpdateSchema = z.object({
  tz: z.string().max(64).optional(),
  postDay: z.literal('sunday').optional(),
  onboarded: z.boolean().optional(),
  reflectionPreferences: reflectionPreferencesSchema.optional(),
  weeklyLetters: z.boolean().optional(),
  welcomeLetters: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const emptyBodySchema = z.object({}).passthrough();

// ---- Documents ----

export interface GroundingRef {
  entryId?: string; // cited notebook entry — exactly one of entryId/replyId
  replyId?: string; // cited user reply (e.g. crisis letters answer a reply directly)
  quotedPhrase: string;
  entryDate?: string; // ISO date of the cited entry, filled server-side
}

export interface EntryDoc {
  id: string;
  bodyMd: string;
  createdAt: string; // ISO
}

export interface LetterDoc {
  reflection?: ReflectionSelection;
  id: string;
  cid: CorrespondentId;
  cycleId: string;
  genre: LetterGenre;
  salutation: string;
  bodyMd: string;
  groundingRefs: GroundingRef[];
  extrapolationNote?: string;
  exercise?: string;
  status: LetterStatus;
  createdAt: string;
}

// The Study-volume view of a letter (roadmap M2-7): a still-sealed letter
// travels without its text — the volume shows the seal, not the words. Only
// the letter page (the unseal moment) reveals the text fields. For
// opened/replied/final letters they are all present.
export interface VolumeLetter
  extends Omit<LetterDoc, 'bodyMd' | 'salutation' | 'groundingRefs' | 'extrapolationNote' | 'exercise'> {
  bodyMd?: string;
  salutation?: string;
  groundingRefs?: GroundingRef[];
  extrapolationNote?: string;
  exercise?: string;
  replies?: ReplyDoc[];
}

export interface ReplyDoc {
  id: string;
  letterId: string;
  cid: CorrespondentId;
  bodyMd: string;
  intents: ReplyIntent[];
  topics?: string[];
  processed: boolean;
  createdAt: string;
}

export interface CorrespondentDoc {
  cid: CorrespondentId;
  cardVersion: number;
  status: 'active' | 'concluded';
  activatedAt: string;
  concludedAt?: string;
}

export interface MemoryTheme {
  theme: string;
  evidence: string;
  trend: 'new' | 'recurring' | 'fading';
}

export interface MemoryExercise {
  exercise: string;
  status: 'given' | 'attempted' | 'completed' | 'dropped';
}

export interface MemoryDoc {
  version: number;
  createdAt: string;
  themesObserved: MemoryTheme[];
  openThreads: string[];
  exercisesGiven: MemoryExercise[];
  toneCalibration: string;
  retiredItems: string[];
  letterCount: number;
}

export interface CycleDoc {
  reflection?: ReflectionSelection;
  id: string;
  kind: 'scheduled' | 'requested' | 'welcome' | 'concluding';
  state: 'composing' | 'delivered' | 'failed';
  createdAt: string;
  updatedAt?: string;
  notes: string[];
  deliveredCids?: CorrespondentId[];
  // Correspondents whose letter did not come through in this cycle (the
  // human-readable reason lives in notes). Lets the Desk say so honestly.
  degradedCids?: CorrespondentId[];
}

// ---- API payloads ----

export interface DeskPayload {
  profile: {
    tz: string;
    postDay: 'sunday';
    onboarded: boolean;
    crisisNotice: boolean;
    reflectionPreferences?: ReflectionPreferences;
    weeklyLetters?: boolean;
    displayName?: string;
  };
  correspondents: CorrespondentDoc[];
  waitingLetters: LetterDoc[]; // sealed letters
  recentLetters: LetterDoc[]; // most recent per correspondent, any status
  composing: { cycleId: string; kind: string; startedAt: string; reflection?: boolean }[];
  // Letters that did not come through recently and have not been superseded by
  // a later letter from the same correspondent. Silent failure is the one
  // thing the Desk must never do.
  undelivered: { cycleId: string; kind: string; cid: CorrespondentId; at: string }[];
  nextPostDay: string; // ISO date of the user's next Sunday (local)
  requestUsedToday: Partial<Record<CorrespondentId, boolean>>;
}

export interface LetterBundle extends LetterDoc {
  replies: ReplyDoc[];
  sourceEntries: EntryDoc[]; // entries cited by groundingRefs
  sourceReplies: ReplyDoc[]; // replies cited by groundingRefs
  correspondent: { cid: CorrespondentId; status: 'active' | 'concluded' };
}

export interface TrustPayload {
  rulesResults: unknown | null;
  evalResults: unknown | null;
  modelLadder: string[];
  appCheckMode: 'monitor' | 'enforce' | 'off (emulator)';
  memoryLog: {
    cid: CorrespondentId;
    versions: { version: number; createdAt: string; themes: number; openThreads: number }[];
  }[];
  rateLimits: { scope: string; windowMs: number; max: number; used: number }[];
  vaultLine: string;
  personasVersion: string;
  atlasPack?: {
    version: string;
    edition: string;
    plateCount: number;
    sourceCount: number;
    imagery: string;
  };
}
