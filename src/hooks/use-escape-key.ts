"use client";

import { useEffect } from "react";

/**
 * Calls `onEscape` whenever the Escape key is pressed while `enabled` is true.
 *
 * For custom modal overlays (plain `fixed inset-0` divs). Base UI dialogs
 * (`@/components/ui/dialog`, `@/components/ui/sheet`) already close on Escape
 * natively and should NOT use this. Pass `enabled` so the listener is only
 * attached while the modal is actually open.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}
