import { z } from 'zod';
import { reflectionPreferencesSchema } from '../../shared/schemas';

const base = z.object({ entryId: z.uuid(), preferences: reflectionPreferencesSchema });
const schema = z.discriminatedUnion('status', [
  base.extend({ status: z.literal('pending'), bodyMd: z.string().optional() }),
  base.extend({ status: z.literal('draft'), bodyMd: z.string() }),
  base.extend({ status: z.literal('saved') }),
]);
export type OnboardingReceipt = z.infer<typeof schema>;
const key = (uid: string) => `lucilio-onboarding-entry:${encodeURIComponent(uid)}`;

export function readReceipt(uid: string): OnboardingReceipt | null {
  const raw = localStorage.getItem(key(uid));
  return raw === null ? null : schema.parse(JSON.parse(raw));
}

// Async confirmations must never overwrite a draft edited in another tab or
// re-create a receipt that sign-out removed.
export function isCurrentReceipt(uid: string, expected: OnboardingReceipt): boolean {
  const stored = readReceipt(uid);
  return stored?.entryId === expected.entryId && stored.status === expected.status
    && (stored.status === 'saved' || (expected.status !== 'saved' && stored.bodyMd === expected.bodyMd));
}

export function writeReceipt(uid: string, receipt: OnboardingReceipt) {
  localStorage.setItem(key(uid), JSON.stringify(receipt));
}

export function clearReceipt(uid: string) {
  localStorage.removeItem(key(uid));
}
