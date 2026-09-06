import type { SVGProps } from 'react';

// Inline icon set for the nav, account menu, and waiting tray. Icons default
// to a 20px box (nav-scale) and inherit color via currentColor so they follow
// the surrounding text/link color; the wax seal stays a literal color since
// it represents the physical seal, not UI chrome.
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
}

export function NotebookIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucilio-icon notebook${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M2 3h8a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H2z" />
      <path d="M22 3h-8a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h8z" />
      <path d="M8 3v7l2-1.5 2 1.5V3" />
    </svg>
  );
}

export function LetterIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucilio-icon letter${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 4-10 8L2 4" />
      <path d="m2 20 10-8 10 8" />
      <circle cx="12" cy="12" r="3" fill="#7a4a2b" stroke="none" />
    </svg>
  );
}

export function CompassIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucilio-icon compass${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucilio-icon shield${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function GearIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucilio-icon gear${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const SEAL_LETTERS: Record<string, 'D' | 'F' | 'C'> = {
  director: 'D',
  future_self: 'F',
  foreign: 'C',
};

// Maps a correspondent id to its wax-seal initial. Falls back to '•' for an
// unrecognized id so a seal always renders something rather than nothing.
export function sealLetter(cid: string): 'D' | 'F' | 'C' | '•' {
  return SEAL_LETTERS[cid] ?? '•';
}

interface SealProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  letter: 'D' | 'F' | 'C' | '•';
  size?: number;
}

export function Seal({ letter, size = 36, className, ...rest }: SealProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`lucilio-seal${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <circle cx="24" cy="24" r="22" fill="#7a4a2b" />
      <circle cx="24" cy="24" r="19" fill="none" stroke="#a9713f" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#a9713f" strokeWidth="0.5" opacity="0.5" />
      <text
        x="24"
        y="25"
        fill="#faf6ee"
        fontFamily="Palatino, 'Iowan Old Style', Georgia, serif"
        fontSize="24"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {letter}
      </text>
    </svg>
  );
}

export function AtlasFrame({ className, ...rest }: Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      fill="none"
      stroke="#2b2620"
      className={`lucilio-atlas-frame${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <rect x="5" y="5" width="590" height="390" strokeWidth="0.75" />
      <rect x="12" y="12" width="576" height="376" strokeWidth="1.5" />
      <path d="M 12 40 C 25 40 40 25 40 12" strokeWidth="1" />
      <circle cx="20" cy="20" r="1.5" fill="#2b2620" stroke="none" />
      <path d="M 588 40 C 575 40 560 25 560 12" strokeWidth="1" />
      <circle cx="580" cy="20" r="1.5" fill="#2b2620" stroke="none" />
      <path d="M 12 360 C 25 360 40 375 40 388" strokeWidth="1" />
      <circle cx="20" cy="380" r="1.5" fill="#2b2620" stroke="none" />
      <path d="M 588 360 C 575 360 560 375 560 388" strokeWidth="1" />
      <circle cx="580" cy="380" r="1.5" fill="#2b2620" stroke="none" />
    </svg>
  );
}
