import { useEffect, useRef, type RefObject } from "react";

interface UseFocusTrapOptions {
  /** Whether the trap is active. */
  active: boolean;
  /** Callback when Escape is pressed. */
  onEscape?: () => void;
  /** Element to focus initially. If not provided, the first focusable child is focused. */
  initialFocus?: HTMLElement | null;
}

/**
 * Traps keyboard focus within a container element.
 * Used for modals, dialogs, and drawers to keep focus contained.
 *
 * Usage:
 *   const panelRef = useRef<HTMLDivElement>(null);
 *   useFocusTrap({ active: isOpen, onEscape: () => setIsOpen(false), panelRef });
 *   // ... panelRef used on the container element
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseFocusTrapOptions,
): void {
  const { active, onEscape, initialFocus } = options;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Save the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    const element = ref.current;
    if (!element) return;

    // Focus the initial element or the container
    if (initialFocus) {
      initialFocus.focus();
    } else {
      const firstFocusable = element.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }

    // Prevent body scrolling
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Keyboard handler — trap focus + escape
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = element.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the previously focused element
      previousFocusRef.current?.focus();
    };
  }, [active, onEscape, initialFocus, ref]);
}
