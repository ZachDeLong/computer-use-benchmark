import { useStore } from './store';
import type { ModalState } from '../core/types';

export function Modal({ modal }: { modal: ModalState }) {
  const dismiss = useStore((s) => s.dismissModal);
  return (
    <div className="modal-overlay" data-testid="modal-overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal" role="dialog" aria-modal="true" data-testid={`modal-${modal.id}`}>
        <div className="modal-title">{modal.title}</div>
        <div className="modal-body">{modal.body}</div>
        <div className="modal-buttons">
          {modal.buttons.map((b, i) => (
            <button key={b} className={i === modal.buttons.length - 1 ? 'btn btn-primary' : 'btn'} data-testid={`modal-btn-${i}`} onClick={dismiss}>
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
