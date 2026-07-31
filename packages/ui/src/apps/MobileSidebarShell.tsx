import React from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine } from '@remixicon/react';

import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SIDEBAR_ROOT_ID = 'mobile-sidebar-root';
const DISMISS_THRESHOLD_PX = 90;
const ENTER_DELAY_MS = 16;
const ENTER_DURATION_MS = 220;

const ensureSidebarRoot = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById(SIDEBAR_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = SIDEBAR_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
};

export type MobileSidebarShellProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  trailing?: React.ReactNode;
  /** If true, disable swipe-left-to-dismiss (e.g. nested drag handles). */
  disableSwipeDismiss?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
};

export const MobileSidebarShell: React.FC<MobileSidebarShellProps> = ({
  open,
  onClose,
  title,
  trailing,
  disableSwipeDismiss = false,
  ariaLabel,
  children,
}) => {
  const { t } = useI18n();
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const dragStartXRef = React.useRef<number | null>(null);
  const isDraggingRef = React.useRef(false);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  if (typeof document !== 'undefined' && !rootRef.current) {
    rootRef.current = ensureSidebarRoot();
  }

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.setTimeout(() => setEntered(true), ENTER_DELAY_MS);
      return () => window.clearTimeout(id);
    }
    setEntered(false);
    const id = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new Event('oc:mobile-overlay-opened'));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.dispatchEvent(new Event('oc:mobile-overlay-closed'));
      previousFocusRef.current?.focus?.({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [open]);

  const handleDragStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (disableSwipeDismiss) return;
    dragStartXRef.current = event.touches[0]?.clientX ?? null;
    isDraggingRef.current = true;
  };

  const handleDragMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragStartXRef.current == null) return;
    const currentX = event.touches[0]?.clientX ?? dragStartXRef.current;
    const delta = currentX - dragStartXRef.current;
    setDragOffset(delta < 0 ? delta : 0);
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragStartXRef.current = null;
    if (dragOffset <= -DISMISS_THRESHOLD_PX) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!mounted || !rootRef.current) return null;

  const visualTransform = !entered
    ? 'translateX(-100%)'
    : dragOffset < 0
      ? `translateX(${dragOffset}px)`
      : 'none';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-[rgb(0_0_0_/_0.45)] transition-opacity duration-200 ease-out',
        entered ? 'opacity-100' : 'opacity-0',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <section
        ref={panelRef}
        className={cn(
          'flex h-full min-h-0 w-[min(85vw,320px)] max-w-[320px] flex-col overflow-hidden border-r border-border/40 bg-sidebar text-foreground shadow-none',
          'pt-[var(--oc-safe-area-top,0px)]',
        )}
        style={{
          transform: visualTransform,
          transition: dragOffset !== 0
            ? 'none'
            : `transform ${ENTER_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
      >
        <div className="flex h-[var(--oc-header-height,56px)] shrink-0 items-center gap-1.5 border-b border-border/30 px-3">
          <button
            type="button"
            className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-interactive-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t('mobile.surface.closeAria')}
            onClick={onClose}
            style={{ touchAction: 'manipulation' }}
          >
            <RiCloseLine className="size-5" />
          </button>
          {title ? (
            <h2 className="min-w-0 flex-1 truncate typography-ui-label font-semibold text-foreground">
              {title}
            </h2>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </section>
    </div>,
    rootRef.current,
  );
};
