import { useEffect, useRef } from 'react';
import { KEYBOARD_SHORTCUTS_HELP } from '@/hooks/index';
import './KeyboardShortcutsHelp.css';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="ksh-overlay">
      <div className="ksh-modal" ref={modalRef}>
        <div className="ksh-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="ksh-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ksh-content">
          <table className="ksh-table">
            <tbody>
              {KEYBOARD_SHORTCUTS_HELP.map((shortcut, index) => (
                <tr key={index} className="ksh-row">
                  <td className="ksh-keys">
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="ksh-key">{key}</kbd>
                        {i < shortcut.keys.length - 1 && ' + '}
                      </span>
                    ))}
                  </td>
                  <td className="ksh-description">{shortcut.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
