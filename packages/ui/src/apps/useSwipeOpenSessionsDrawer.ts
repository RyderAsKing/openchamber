import React from 'react';

const EDGE_ZONE_PX = 48;
const OPEN_ZONE_RATIO = 0.28;
const MIN_DISTANCE_PX = 64;
const MAX_OFF_AXIS_RATIO = 0.7;

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]'));
};

export interface SwipeOpenSessionsDrawerOptions {
  enabled?: boolean;
  onOpen: () => void;
}

/**
 * Opens the sessions drawer when the user swipes right from the left edge or
 * from empty space in the chat column (non-interactive targets in the left
 * ~28% of the view). Uses passive touch listeners so vertical scrolling stays
 * smooth; only clearly horizontal rightward swipes commit.
 */
export const useSwipeOpenSessionsDrawer = (
  ref: React.RefObject<HTMLElement | null>,
  options: SwipeOpenSessionsDrawerOptions,
): void => {
  const onOpenRef = React.useRef(options.onOpen);
  onOpenRef.current = options.onOpen;
  const enabled = options.enabled !== false;

  React.useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let fromOpenZone = false;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      if (isInteractiveTarget(event.target)) {
        tracking = false;
        return;
      }

      const touch = event.touches[0];
      const rect = element.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;
      const nearLeftEdge = relativeX <= EDGE_ZONE_PX;
      const inOpenZone = relativeX <= rect.width * OPEN_ZONE_RATIO;
      fromOpenZone = nearLeftEdge || inOpenZone;
      tracking = fromOpenZone;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (dx < MIN_DISTANCE_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS_RATIO) return;

      onOpenRef.current();
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, ref]);
};
