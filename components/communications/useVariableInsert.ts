'use client';

import { useCallback, useRef } from 'react';

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * Lets the variable palette drop `{{customer.firstName}}` straight into whichever
 * field the user last used, at the caret — copying to the clipboard and asking
 * them to paste is a lot to expect of a first-time user.
 *
 * Spread `bind(setValue)` onto any input/textarea to register it.
 */
export function useVariableInsert() {
  const active = useRef<{ element: Field; setValue: (value: string) => void } | null>(null);

  const bind = useCallback(
    (setValue: (value: string) => void) => ({
      onFocus: (event: React.FocusEvent<Field>) => {
        active.current = { element: event.currentTarget, setValue };
      },
    }),
    [],
  );

  /** Returns false when no field has been focused yet, so callers can fall back. */
  const insert = useCallback((text: string) => {
    const target = active.current;
    if (!target || !target.element.isConnected) return false;
    const { element, setValue } = target;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    setValue(element.value.slice(0, start) + text + element.value.slice(end));
    // Restore the caret after React re-renders the controlled value.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + text.length, start + text.length);
    });
    return true;
  }, []);

  return { bind, insert };
}
