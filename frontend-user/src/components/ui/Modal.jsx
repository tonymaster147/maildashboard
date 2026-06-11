import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { C } from '../../theme/tokens';

// Modal — fixed overlay + centered card. Close on overlay click or X / Escape.
// Width prop: max-width of the inner card (default 480).
//
//   <Modal open={state} onClose={...} title="Edit credentials">
//     ...
//   </Modal>
export default function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: C.radiusXl,
          boxShadow: C.shadowLg,
          width: '100%', maxWidth: width,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        {(title || onClose) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {title && (
              <h3 style={{
                fontSize: 14, fontWeight: 800, color: C.textPrimary,
                margin: 0, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                {title}
              </h3>
            )}
            {onClose && (
              <button
                type="button" onClick={onClose} aria-label="Close"
                style={{
                  marginLeft: 'auto', width: 30, height: 30, borderRadius: 8,
                  border: 'none', background: '#f1f5f9', color: C.textSecondary,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        )}
        <div style={{ padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
