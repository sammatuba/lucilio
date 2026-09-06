import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut, type User } from '../lib/auth';
import { downloadExport } from '../lib/api';
import { GearIcon, LetterIcon, ShieldIcon } from './icons';

// Top bar account control: a single button that reveals Trust Center,
// export, and sign-out — keeps the bar calm while still one click away.
export default function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="account-menu">
      <button
        ref={buttonRef}
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {user.displayName ?? user.email ?? 'Your account'} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="account-menu-panel" role="menu" ref={menuRef}>
          <Link to="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <GearIcon size={16} />Settings
          </Link>
          <Link to="/trust" role="menuitem" onClick={() => setOpen(false)}>
            <ShieldIcon size={16} />Trust Center
          </Link>
          <Link to="/about" role="menuitem" onClick={() => setOpen(false)}>
            <LetterIcon size={16} /> About Lucilio
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              downloadExport();
            }}
          >
            <LetterIcon size={16} />Export my data
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
