import { useLayoutEffect, useRef } from "react";

import { usePanelAnimationSettings } from "../../panelAnimations";

/**
 * Slides cards from where they were to where they now are, once per layout
 * change. Cards move because the work moved — an agent finished, a review
 * landed — so the animation is the only thing on screen saying so.
 *
 * FLIP over the Web Animations API rather than a transition on every card:
 * the animation runs on the frames after a column changes and then stops, so
 * nothing repaints while the board sits still.
 */
export function useFlipCards(layoutKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousRectsRef = useRef(new Map<string, DOMRect>());
  const measuredLayoutKeyRef = useRef<string | null>(null);
  const { active, durationMs } = usePanelAnimationSettings();

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Re-measuring on a render that left every card where it was would replace
    // the positions the next real move has to animate from.
    if (measuredLayoutKeyRef.current === layoutKey) return;
    measuredLayoutKeyRef.current = layoutKey;

    const previousRects = previousRectsRef.current;
    const nextRects = new Map<string, DOMRect>();

    for (const card of container.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      const key = card.dataset.flipKey;
      if (key === undefined) continue;
      const rect = card.getBoundingClientRect();
      nextRects.set(key, rect);

      const previousRect = previousRects.get(key);
      if (!active || previousRect === undefined) continue;

      const deltaX = previousRect.left - rect.left;
      const deltaY = previousRect.top - rect.top;
      // Sub-pixel drift is reflow noise, not movement worth showing.
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;

      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        { duration: durationMs, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    }

    previousRectsRef.current = nextRects;
  }, [active, durationMs, layoutKey]);

  return containerRef;
}
