import { useCallback, useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useDismiss } from '../../hooks/useDismiss';
import { ROLE_LABELS } from '../../services/types';
import { Icon } from '../ui/Icon';

export function UserMenu() {
  const { user, signOut, config } = useSession();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  if (!user) return null;
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="usermenu" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} title={user.email} aria-expanded={open}>
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="inicial">{initial}</span>}
        <span className="nome">{user.name.split(' ')[0]}</span>
        {user.role !== 'VIEWER' && <span className="papel">{ROLE_LABELS[user.role]}</span>}
      </button>
      {open && (
        <div className="usermenu-pop">
          <div className="quem">
            <b>{user.name}</b>
            <span>{user.email}</span>
          </div>
          {config?.enabled && (
            <button type="button" onClick={signOut}>
              <Icon name="sair" size={14} /> Sair
            </button>
          )}
        </div>
      )}
    </div>
  );
}
