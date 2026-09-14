/**
 * Keyboard Shortcuts Hook for BMO Media Session
 * Maps user shortcuts to action events.
 */

import { useEffect } from 'react';

export function useKeyboard(onAction) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept inputs inside textareas/inputs if any
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key;

      switch (key) {
        case 'ArrowRight':
          e.preventDefault();
          onAction('NEXT_VIDEO');
          break;

        case 'ArrowLeft':
          e.preventDefault();
          onAction('PREV_VIDEO');
          break;

        case 'n':
        case 'N':
          e.preventDefault();
          onAction('NEXT_TAG');
          break;

        case 'b':
        case 'B':
          e.preventDefault();
          onAction('PREV_TAG');
          break;

        case 'PageDown':
          e.preventDefault();
          onAction('NEXT_AUDIO');
          break;

        case 'PageUp':
          e.preventDefault();
          onAction('PREV_AUDIO');
          break;

        case ' ':
          e.preventDefault();
          onAction('TOGGLE_PLAY');
          break;

        case 'h':
        case 'H':
          e.preventDefault();
          onAction('TOGGLE_HUD');
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          onAction('TOGGLE_FULLSCREEN');
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          onAction('TOGGLE_MUTE');
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onAction]);
}
