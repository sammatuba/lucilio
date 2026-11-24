const readingArt = new Map([
  ['trust', 'trust-rim'],
  ['belonging', 'belonging-table'],
  ['attention', 'attention-phone'],
  ['good-life', 'good-life-case'],
  ['responsibility', 'responsibility-proof'],
  ['uncertainty', 'uncertainty-keys'],
]);

export default function ReadingSketch({ id, lazy = false }: { id: string; lazy?: boolean }) {
  const artwork = readingArt.get(id);
  if (!artwork) return null;
  return <img className="reading-sketch" src={`/${artwork}.webp`} width="560" height="280"
    alt="" loading={lazy ? 'lazy' : 'eager'} decoding="async" />;
}
