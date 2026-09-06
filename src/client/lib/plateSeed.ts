// One-shot handoff from an Atlas plate to the Notebook composer ("Write from
// this"). Module-level memory on purpose: it survives SPA navigation but dies
// on a page reload, so a refresh can never re-seed the composer — the composer
// only ever gets words the user explicitly asked for.
export interface PlateSeed {
  plate: string;
  title: string;
  quote: string;
}

let seed: PlateSeed | null = null;

export function setPlateSeed(s: PlateSeed): void {
  seed = s;
}

export function takePlateSeed(): PlateSeed | null {
  const s = seed;
  seed = null;
  return s;
}
