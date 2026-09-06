// The model-access contract (§3.5): one fallback helper, pinned ladder, and
// backoff that can actually outlast a per-minute burst limit on the primary
// when the lower rungs are unavailable.
import { describe, expect, it, vi } from 'vitest';
import { generateContentWithFallback, isRecoverable } from '../../src/server/gemini.js';

const fast = { rungBackoffMs: () => 0, passBackoffMs: [0, 0] as const };
const err = (status: number, msg = 'x') => Object.assign(new Error(`{"error":{"code":${status},"message":"${msg}"}}`), { status });

describe('generateContentWithFallback', () => {
  it('returns the first rung that answers', async () => {
    const call = vi.fn().mockRejectedValueOnce(err(429, 'quota')).mockResolvedValueOnce('from-rung-2');
    const out = await generateContentWithFallback(call, { ...fast, ladder: ['a', 'b'] });
    expect(out).toBe('from-rung-2');
    expect(call.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('walks the ladder again after a full pass fails on recoverable errors (burst 429 + dead rungs)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const call = vi
      .fn()
      .mockRejectedValueOnce(err(429, 'You exceeded your current quota'))
      .mockRejectedValueOnce(err(404, 'not found'))
      .mockRejectedValueOnce(err(503, 'high demand'))
      .mockResolvedValueOnce('primary-after-wait');
    const out = await generateContentWithFallback(call, { ...fast, ladder: ['primary', 'dead', 'alias'] });
    expect(out).toBe('primary-after-wait');
    expect(call).toHaveBeenCalledTimes(4);
    expect(call.mock.calls[3]![0]).toBe('primary'); // the second pass starts from the top
  });

  it('gives up after the last pass and surfaces the last error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const call = vi.fn().mockRejectedValue(err(503, 'still down'));
    await expect(generateContentWithFallback(call, { ...fast, ladder: ['a', 'b'] })).rejects.toThrow(/still down/);
    expect(call).toHaveBeenCalledTimes(2 * (fast.passBackoffMs.length + 1));
  });

  it('a non-recoverable error fails immediately — no rung walk, no passes', async () => {
    const call = vi.fn().mockRejectedValue(err(400, 'invalid schema'));
    await expect(generateContentWithFallback(call, { ...fast, ladder: ['a', 'b'] })).rejects.toThrow(/invalid schema/);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('classifies statuses and transient network errors as recoverable', () => {
    expect(isRecoverable(err(429))).toBe(true);
    expect(isRecoverable(err(503))).toBe(true);
    expect(isRecoverable(err(504, 'Deadline expired before operation could complete.'))).toBe(true);
    expect(isRecoverable(new Error('fetch failed'))).toBe(true);
    expect(isRecoverable(err(400))).toBe(false);
    expect(isRecoverable(new Error('unexpected token'))).toBe(false);
  });
});
