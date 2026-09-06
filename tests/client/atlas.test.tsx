// @vitest-environment jsdom
// The Atlas client: the index is a table of contents (not a feed); a plate
// renders the essay, margin notes, and sources; a missing vantage image
// degrades to the typographic hero; "Write from this" hands a seed to the
// Notebook — which only ever fills an empty composer.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Atlas from '../../src/client/views/Atlas';
import AtlasPlate from '../../src/client/views/AtlasPlate';
import Notebook from '../../src/client/views/Notebook';
import { setPlateSeed, takePlateSeed } from '../../src/client/lib/plateSeed';
import type { AtlasIndexPayload, AtlasPlatePayload } from '../../src/shared/atlas';

vi.mock('../../src/client/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
  getBlob: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  downloadExport: vi.fn(),
}));
import { api, getBlob } from '../../src/client/lib/api';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
}));
vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: null,
  googleProvider: {},
  useEmulators: true,
}));
vi.mock('firebase/app-check', () => ({ getToken: vi.fn(async () => null) }));
vi.mock('../../src/client/lib/entrySave', () => ({ saveEntry: vi.fn() }));

function fixturePlate(id = 'liternum', number = 1) {
  return {
    id,
    number,
    kind: 'place' as const,
    title: 'Liternum: the garden of the general',
    standfirst: 'A retired general’s villa, and what time does to glory.',
    question: 'What would you keep?',
    writeFromQuote: 'The garden outlasted the general.',
    view: {
      kind: 'streetview' as const,
      lat: 41.0431,
      lng: 14.0017,
      heading: 315,
      pitch: 5,
      fov: 90,
      placeLine: 'Lago Patria, Italy',
      coordsLine: '41.0431° N, 14.0017° E',
    },
    bodyMd: 'The colony keeps a low profile under the modern streets.\n\nAsk the garden what it kept.',
    marginNotes: [
      { fact: 'Scipio defeats Hannibal at Zama.', date: '202 BC' },
      { fact: 'Scipio withdraws to Liternum.', date: 'c. 187 BC' },
      { fact: 'Seneca writes Letter 86 after a visit.', date: 'c. AD 50s' },
    ],
    sources: [
      {
        title: 'Liternum',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Liternum',
        retrievedAt: '2026-09-06',
      },
    ],
  };
}

function fixtureIndex(plate: ReturnType<typeof fixturePlate>): AtlasIndexPayload {
  return {
    pack: {
      version: 'atlas-v1.1.0',
      edition: 'What endures',
      editionNumber: 1,
      createdAt: '2026-09-06',
      plateCount: 1,
      sourceCount: 1,
      provenance: 'Hand-curated first edition.',
    },
    plates: [
      {
        id: plate.id,
        number: plate.number,
        kind: plate.kind,
        title: plate.title,
        standfirst: plate.standfirst,
        placeLine: plate.view.placeLine,
        imagery: plate.view.kind,
      },
    ],
  };
}

beforeEach(() => {
  cleanup();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(getBlob).mockReset();
  // jsdom has no object URL implementation.
  URL.createObjectURL = vi.fn(() => 'blob:mock-vantage');
  URL.revokeObjectURL = vi.fn(() => undefined);
});

describe('Atlas index (a table of contents, never a feed)', () => {
  it('lists plates in order with plate numbers and places', async () => {
    const plate = fixturePlate();
    vi.mocked(api.get).mockResolvedValue(fixtureIndex(plate));
    render(
      <MemoryRouter>
        <Atlas />
      </MemoryRouter>,
    );
    expect(await screen.findByText('The Atlas')).toBeTruthy();
    expect(screen.getByText('Plate I')).toBeTruthy();
    expect(screen.getByText('Liternum: the garden of the general')).toBeTruthy();
    expect(screen.getByText('Lago Patria, Italy')).toBeTruthy();
  });

  it('degrades to a plain note on a malformed or failed payload', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    render(
      <MemoryRouter>
        <Atlas />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/could not be opened/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('retries a transient index failure in place', async () => {
    const plate = fixturePlate();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(fixtureIndex(plate));
    render(
      <MemoryRouter>
        <Atlas />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('The Atlas')).toBeTruthy();
  });
});

describe('Atlas plate (vantage, essay, margin, question)', () => {
  it('distinguishes a missing plate from a transient failure', async () => {
    vi.mocked(api.get).mockRejectedValue({ status: 404 });
    render(
      <MemoryRouter initialEntries={['/atlas/unknown']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no such plate/i)).toBeTruthy();

    cleanup();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockRejectedValue(new Error('temporary outage'));
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/could not be opened right now/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('renders the essay, margin notes, sources, and the question to carry', async () => {
    vi.mocked(api.get).mockResolvedValue({
      pack: { version: 'atlas-v1.1.0', edition: 'What endures' },
      plate: fixturePlate(),
    } satisfies AtlasPlatePayload);
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/garden of the general/)).toBeTruthy();
    expect(await screen.findByText(/Ask the garden what it kept/)).toBeTruthy();
    expect(screen.getByText('Margin notes')).toBeTruthy();
    expect(screen.getByText('A question to carry')).toBeTruthy();
    expect(screen.getByText(/retrieved 2026-09-06/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /write from this/i })).toBeTruthy();
  });

  it('shows the vantage image with its attribution when coverage exists', async () => {
    const payload = {
      pack: { version: 'atlas-v1.1.0', edition: 'What endures' },
      plate: fixturePlate(),
    };
    vi.mocked(api.get)
      .mockResolvedValueOnce(payload)
      .mockResolvedValueOnce({ ok: true, copyright: '© Example Photographer', date: '2023-03' });
    vi.mocked(getBlob).mockResolvedValue(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/© Example Photographer · Google Maps/)).toBeTruthy();
    expect(document.querySelector('.atlas-hero')?.className).toContain('with-image');
    expect(document.querySelector('img.atlas-vantage')).toBeTruthy();
  });

  it('degrades the hero to typographic when the image fetch fails', async () => {
    const payload = {
      pack: { version: 'atlas-v1.1.0', edition: 'What endures' },
      plate: fixturePlate(),
    };
    vi.mocked(api.get)
      .mockResolvedValueOnce(payload)
      .mockResolvedValueOnce({ ok: true, copyright: '© Google', date: '2023-03' });
    vi.mocked(getBlob).mockRejectedValue(new Error('image unavailable'));
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    await screen.findByText(/garden of the general/);
    expect(document.querySelector('.atlas-hero')?.className).toContain('typographic');
    expect(screen.queryByText(/Google Maps/)).toBeNull();
  });

  it('opens the typographic plate when no coverage exists (ok:false)', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        pack: { version: 'atlas-v1.1.0', edition: 'What endures' },
        plate: fixturePlate(),
      })
      .mockResolvedValueOnce({ ok: false });
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <AtlasPlate />
      </MemoryRouter>,
    );
    await screen.findByText(/garden of the general/);
    expect(document.querySelector('.atlas-hero')?.className).toContain('typographic');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/Google Maps/)).toBeNull();
  });

  it('"Write from this" seeds the Notebook handoff and navigates', async () => {
    vi.mocked(api.get).mockResolvedValue({
        pack: { version: 'atlas-v1.1.0', edition: 'What endures' },
      plate: fixturePlate(),
    });
    render(
      <MemoryRouter initialEntries={['/atlas/liternum']}>
        <Routes>
          <Route path="/atlas/:id" element={<AtlasPlate />} />
          <Route path="/notebook" element={<div>notebook-landing</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /write from this/i }));
    expect(await screen.findByText('notebook-landing')).toBeTruthy();
    const seed = takePlateSeed();
    expect(seed?.quote).toBe('The garden outlasted the general.');
    expect(seed?.title).toContain('Liternum');
  });
});

describe('Notebook "Write from this" prefill (never touches existing words)', () => {
  const user = { uid: 'u1', displayName: 'Tester' } as never;

  it('sets the plate down in an empty composer', async () => {
    setPlateSeed({ plate: 'Plate I', title: 'Liternum: the garden of the general', quote: 'The garden outlasted the general.' });
    vi.mocked(api.get).mockRejectedValue(new Error('no prefs'));
    render(
      <MemoryRouter>
        <Notebook user={user} desk={null} refresh={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('The garden outlasted the general.'));
    const value = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
    expect(value.startsWith('> “The garden outlasted the general.”')).toBe(true);
    expect(value).toContain('— Plate I, Liternum: the garden of the general');
  });

  it('the handoff is one-shot: a refresh cannot re-seed the composer', async () => {
    setPlateSeed({ plate: 'Plate I', title: 'T', quote: 'Q' });
    expect(takePlateSeed()).not.toBeNull();
    expect(takePlateSeed()).toBeNull();
  });
});
