import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Закрыть" onClick={onClose}><X size={20} aria-hidden="true"/></button></header><div className="modal-body">{children}</div>
  </dialog>;
}
