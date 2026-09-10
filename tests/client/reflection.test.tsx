// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EntryReflection from '../../src/client/components/EntryReflection';
import { DEFAULT_REFLECTION_PREFERENCES } from '../../src/shared/schemas';
vi.mock('../../src/client/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));
import { api } from '../../src/client/lib/api';
beforeEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Reflection invitation', () => {
  it('does not generate on mount; a chosen depth applies to this entry', async () => {
    vi.mocked(api.post).mockResolvedValue({ state: 'delivered', letterId: 'letter-1' });
    vi.mocked(api.get).mockResolvedValue({ bodyMd: 'One possible interpretation.', groundingRefs: [] });
    render(<EntryReflection entryId="entry-1" defaults={DEFAULT_REFLECTION_PREFERENCES} />);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gentle' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Philosophical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reflect on this' }));
    await screen.findByText('One possible interpretation.');
    expect(api.post).toHaveBeenCalledWith('/api/reflections', {
      entryId: 'entry-1', preferences: { ...DEFAULT_REFLECTION_PREFERENCES, depth: 'philosophical' },
    });
    expect(DEFAULT_REFLECTION_PREFERENCES.depth).toBe('gentle');
    fireEvent.click(screen.getByRole('button', { name: 'Finish for now' }));
    expect(screen.queryByText('One possible interpretation.')).toBeNull();
  });

  it('announces a delivered reflection and says what is saved', async () => {
    vi.mocked(api.post).mockResolvedValue({ state: 'delivered', letterId: 'letter-1' });
    vi.mocked(api.get).mockResolvedValue({ bodyMd: 'An interpretation.', groundingRefs: [] });
    render(<EntryReflection entryId="entry-1" defaults={DEFAULT_REFLECTION_PREFERENCES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflect on this' }));
    await screen.findByText('An interpretation.');
    expect(screen.getByText('Your reflection is ready.')).toBeTruthy();
    expect(screen.getByText(/Saved in your notebook\. Write another entry whenever you want/i)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/letters/letter-1/open');
  });

  it('reports generation failures without suggesting the saved entry was lost', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    render(<EntryReflection entryId="entry-1" defaults={DEFAULT_REFLECTION_PREFERENCES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflect on this' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Your entry is saved'));
    expect(screen.getByRole('button', { name: 'Reflect on this' }).hasAttribute('disabled')).toBe(false);
  });
});
