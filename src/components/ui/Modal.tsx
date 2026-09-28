import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';

type ModalProps = { title: string; onClose: () => void; children: ReactNode; size?: 'default' | 'narrow' };

export function Modal({ title, onClose, children, size = 'default' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscapeKey(true, onClose);
  useFocusTrap(dialogRef);
  useScrollLock(true);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className={`modal ${size === 'narrow' ? 'modal-narrow' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1}>
        <div className="modal-header">
          <div><span className="eyebrow">WORKSPACE ACTION</span><h2 id={titleId}>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
