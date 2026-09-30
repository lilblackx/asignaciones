import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ onClose, zIndexClass = 'z-50', children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Runs once per mount: initial focus + key handling. Reading onClose via a ref
  // avoids re-binding (and re-stealing focus) whenever the parent re-renders
  // with a new inline onClose function, e.g. on every keystroke in a sibling input.
  useEffect(() => {
    const panel = panelRef.current;
    const focusables = panel ? panel.querySelectorAll(FOCUSABLE_SELECTOR) : [];
    if (focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const nodes = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center ${zIndexClass} p-4`} role="presentation">
      <div ref={panelRef} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
