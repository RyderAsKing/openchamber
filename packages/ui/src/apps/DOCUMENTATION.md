# Dedicated Mobile UI

## Purpose

This module owns the **dedicated mobile React surface** (`MobileApp`) — the
phone/tablet UX used by:

- the Capacitor native apps (`packages/mobile`)
- the hosted `mobile.html` entry
- the hosted main entry when the mobile layout preference is `'new'` and the
  host looks like a phone

It does **not** own the Capacitor native shell, push/widgets pipeline, or
desktop `MainLayout`. Those live elsewhere (see [Related docs](#related-docs)).

Use this file when changing mobile chrome, navigation, sheets/surfaces,
composer adaptations, or deciding where a mobile UX change should go.

## Layers (what lives where)

```
packages/mobile          Capacitor WebView host, plugins, iOS/Android projects
        │                loads bundled web assets (mobile.html → index.html)
        ▼
packages/web             Entry HTML + Vite boot (mobile.html / mobile-main.tsx)
        │                also: main.tsx surface selector for hosted/PWA
        ▼
packages/ui/src/apps     MobileApp + surfaces/sheets/connection (THIS MODULE)
        │
        ├── components/  Shared ChatView/ChatInput with mobile branches;
        │                MobilePillComposer, MobileSessionStatusBar, overlays
        ├── styles/mobile.css
        ├── lib/mobileLayoutPreference.ts, mobileKeyboardMode.ts
        └── stores/useMobileSession*.ts
```

| Layer | Change here when… |
|---|---|
| `packages/mobile` | Native plugins, build/sync, widgets, APNs/FCM, Capacitor config, status-bar/keyboard plugin wiring |
| `packages/web` `mobile.html` / `mobile-main.tsx` | Boot entry, viewport meta, which renderer is loaded |
| **`packages/ui/src/apps`** | Header, overflow menu, sheets, connection welcome, Instances, iPad sidebars, surface open/close |
| `packages/ui/src/components/chat*` | Message list, composer expand/collapse, pill UI, agent/model buttons |
| `packages/ui/src/styles/mobile.css` | Safe areas, keyboard inset CSS, touch targets, `.oc-*` mobile classes |
| Desktop `MainLayout` | Legacy narrow layout only (`mobileLayoutPreference === 'default'`) |

**Rule of thumb:** product UX for the dedicated mobile app is almost always in
`packages/ui`. Touch `packages/mobile` only for native shell behavior.

## Entry points

| Path | Role |
|---|---|
| `packages/web/mobile.html` | Dedicated mobile HTML. Viewport locked (`user-scalable=no`, `viewport-fit=cover`). Loads `mobile-main.tsx`. |
| `packages/web/src/mobile-main.tsx` | Always boots `renderMobileApp` — no desktop fork. |
| `packages/web/src/main.tsx` | Hosted surface selector. Routes to MobileApp when `?surface=mobile`, or phone heuristic + `getStoredMobileLayoutPreference() === 'new'`. |
| `packages/ui/src/apps/renderMobileApp.tsx` | Providers (i18n, theme, DiffWorker), native notification no-op, `SessionAuthGate` for **browser only**, then `<MobileApp>`. |
| `packages/ui/src/apps/MobileApp.tsx` | Connection/bootstrap + `MobileShell` chrome. |

### Layout preference

`lib/mobileLayoutPreference.ts` stores `openchamber-mobile-layout`:

- `'new'` (default) → dedicated `MobileApp`
- `'default'` → legacy `MainLayout` with mobile drawers

Appearance settings change this and reload. Prefer improving **`'new'`** /
`MobileApp`; treat `'default'` as legacy unless fixing a regression there.

## Runtime variants

| Concern | Capacitor native | Hosted `mobile.html` / PWA |
|---|---|---|
| Auth / connect | Connection welcome, saved instances, QR, secure tokens | Same-origin API; `SessionAuthGate` for UI password |
| Instances menu | Yes | No |
| Push / deep links / widgets | Yes | No |
| Keyboard | Cap Keyboard `resize: none` + `--oc-keyboard-inset` (iOS); Android `adjustResize` | `mobileKeyboardMode` + visualViewport |
| iPad split sidebars | Yes (`isIPadApp()`) | No |
| Stream transport | Forced SSE | User setting |

Detect Capacitor with `isCapacitorMobileApp()` inside `MobileApp.tsx`. Gate
native-only UI with that flag (already used for Instances, connection screen,
push registration).

## Shell structure

`MobileApp` has two phases:

1. **Bootstrap** — native auto-connect / connection welcome when no endpoint;
   otherwise initialize + `SyncProvider`.
2. **`MobileShell`** — always-on chrome + chat column + optional surfaces.

### Phone chrome

```
┌─ MobileHeader ─────────────────────────────────────────────┐
│ [sessions]  [project title ▾ metadata]              [ ⋮ ]  │
├────────────────────────────────────────────────────────────┤
│ ChatView (shared)                                          │
│   messages…                                                │
│   PendingChangesBar → useMobileAppActions().openChanges    │
│   ChatInput                                                │
│     MobilePillComposer (collapsed) / expanded composer     │
│     MobileSessionStatusBar (quick switcher overlay)        │
└────────────────────────────────────────────────────────────┘
Overlays: OverflowMenu · MobileSurfaceShell sheets ·
          MobileOverlayPanel · SessionMetadataOverlay
```

### iPad (Capacitor only)

- Left: persistent resizable sessions sidebar (`MobileSessionsSheet` variant
  `sidebar`) instead of a bottom sheet.
- Right: Files / Changes as a resizable sidebar; header shortcuts instead of
  overflow items.
- Portrait: opening one side panel closes the other.

Widths persist under `openchamber.ipad.leftSidebarWidth` /
`openchamber.ipad.rightSidebarWidth`.

## Surfaces and how they open

Phone surfaces are **local open flags** in `MobileShell`, mounted only while
open (except iPad sidebars, which animate width and keep content briefly).

| Surface | File | Open via | Host |
|---|---|---|---|
| Sessions | `MobileSessionsSheet.tsx` | Header sessions button; deep link | `MobileSurfaceShell` (phone) or left sidebar (iPad) |
| Files | `MobileFilesSurface.tsx` | Overflow / deep link / `openFiles` | Sheet or iPad right sidebar |
| Changes | `MobileChangesSurface.tsx` | Overflow / PendingChangesBar / deep link | Sheet or iPad right sidebar |
| Terminal | shared `TerminalView` | Overflow | `MobileSurfaceShell` |
| MCP | shared MCP content | Overflow | `MobileOverlayPanel` |
| Instances | inline in `MobileApp.tsx` | Overflow (**Capacitor only**) | `MobileSurfaceShell` |
| Settings | shared `SettingsView` + `forceMobile` | Overflow / actions | Sheet; pages whitelist `MOBILE_SETTINGS_PAGES` |
| Update | `AboutSettings` | Overflow when update available | Sheet |
| Project edit | `MobileProjectEditSurface.tsx` | Sessions sheet project gear | Nested sheet |
| Connection | `MobileConnectionWelcome` in `MobileApp.tsx` | No saved/active endpoint | Full-screen (Capacitor) |

### Cross-component navigation

`mobileAppContext.tsx` exposes `openChanges` / `openFiles` / `openSettings` so
shared chat code can route to mobile surfaces without knowing about desktop
sidebars. Prefer this context over prop-drilling or desktop-only store actions.

Deep links (`deepLinks.ts` / `deepLinkNavigation.ts`):
`openchamber://session|new|sessions|status|settings|changes|view/...`.
Intents are stashed until connected + initialized; `MobileShell` registers
handlers via `useDeepLinkHandlers`.

Android back button closes overlays in order: overflow → sessions → files →
changes → mcp → instances → settings → update.

## File ownership map

### Apps (`packages/ui/src/apps/`)

| File | Owns |
|---|---|
| `MobileApp.tsx` | Bootstrap, native chrome/keyboard/lifecycle/back, connection welcome, Instances, header/overflow/metadata, `MobileShell`, iPad layout, edge-swipe session switch |
| `renderMobileApp.tsx` | React root + provider stack + native vs browser boot differences |
| `mobileAppContext.tsx` | Actions bridge for shared components |
| `MobileSurfaceShell.tsx` | Full-height bottom sheet: scrim, enter animation, drag-dismiss, deferred content mount |
| `MobileSessionsSheet.tsx` | Project → worktree → session tree, search, DnD, new project/worktree |
| `MobileFilesSurface.tsx` | Directory browser + file preview (`browser` \| `file` routes) |
| `MobileChangesSurface.tsx` | Git list + per-file diff, commit/sync; `initialDiffPath` deep entry |
| `MobileProjectEditSurface.tsx` | Project label/icon/color, worktree reorder/delete |
| `MobileDeleteWorktreeDialog.tsx` | Worktree delete confirm |
| `mobileConnections.ts` | Saved instances, secure tokens, connect/unlock/auto-connect |
| `mobileQrScan.ts` | QR pairing payload + Capacitor barcode scan |
| `mobileWidgetSnapshot.ts` | Bridge for iOS widget snapshots |
| `useNativePushRegistration.ts` | Device push token registration when connected |
| `useEdgeSwipeSessionSwitch.ts` | Edge swipe → prev/next session |

### Supporting UI

| Path | Owns |
|---|---|
| `components/chat/composer/ui/MobilePillComposer.tsx` | Collapsed pill composer |
| `components/chat/composer/state/useMobileComposerShell.ts` | Expand/collapse + keyboard handoff |
| `components/chat/composer/state/useMobileViewportPin.ts` | Viewport/keyboard pin corrections |
| `components/chat/MobileSessionStatusBar.tsx` | Composer-adjacent quick session switcher (separate from sessions sheet) |
| `components/chat/MobileAgentButton.tsx` / `MobileModelButton.tsx` | Touch agent/model controls without dismissing keyboard |
| `components/ui/MobileOverlayPanel.tsx` | Shorter bottom overlays (MCP, status panel) |
| `components/update/MobileAppUpdateToast.tsx` | Android native update toast |
| `styles/mobile.css` | Safe area, keyboard inset, typography/touch, `.oc-mobile-*` / `.oc-capacitor-app` |
| `lib/mobileKeyboardMode.ts` | Browser/PWA keyboard mode (`native` \| `resize-content`) |
| `stores/useMobileSessionExpansionStore.ts` | In-memory subsession expand in sessions sheet |
| `stores/useMobileSessionTreeStore.ts` | Persisted project/worktree expand overrides |

## Shared vs mobile-only

**Reuse (do not fork unless necessary):** `ChatView`, `ChatInput` (mobile
branches), sync/stores, git/files APIs, `SettingsView`, `TerminalView`, MCP
panels, theme/i18n, `ChangesPanel` / diff viewers inside mobile surfaces.

**Mobile-only chrome:** `MobileShell`, `MobileHeader`, overflow menu model,
all `Mobile*Surface` / `MobileSessionsSheet`, connection/Instances,
`MobileSurfaceShell`, edge-swipe, iPad sidebars, `DedicatedMobileAppProvider`.

The desktop context-panel rail (`lib/surfaces/`) is **not** used on mobile.
Opening a mobile surface must go through MobileShell flags, overflow, header
shortcuts, deep links, or `useMobileAppActions`.

## Two session UIs (intentional today)

1. **`MobileSessionsSheet`** — full project/worktree/session tree from the
   header (or iPad left sidebar).
2. **`MobileSessionStatusBar`** — lighter recent-session switcher from the
   composer.

UX work that touches “how users switch sessions” should decide which of these
is in scope; consolidating them is a product decision, not an accidental
merge of two files.

## Where to change common UX targets

| Goal | Start here |
|---|---|
| Header layout, overflow items, metadata popover | `MobileApp.tsx` (`MobileHeader`, `MobileShell`, `overflowItems`) |
| Sheet animation / dismiss / safe-area under sheets | `MobileSurfaceShell.tsx`, `MobileOverlayPanel.tsx`, `styles/mobile.css` |
| Sessions tree IA, empty states, reorder | `MobileSessionsSheet.tsx` + mobile session stores |
| Files browse/preview | `MobileFilesSurface.tsx` |
| Git changes / commit flow on phone | `MobileChangesSurface.tsx` |
| Composer pill, expand, keyboard choreography | `ChatInput.tsx`, `MobilePillComposer.tsx`, `useMobileComposerShell.ts`, `useNativeMobileChrome` in `MobileApp.tsx` |
| First-run / reconnect / Instances | `MobileConnectionWelcome`, Instances surface, `mobileConnections.ts` |
| Settings pages available on mobile | `MOBILE_SETTINGS_PAGES` in `MobileApp.tsx` + `SettingsView` mobile stage |
| Touch targets / safe area / keyboard CSS | `styles/mobile.css` |
| Native-only gestures (back, edge swipe, status bar) | hooks inside `MobileApp.tsx` |
| Capacitor plugin / build / widgets | `packages/mobile` (see its README / HANDOFF) |

`MobileApp.tsx` is large (~3k lines) and currently hosts shell + several
inline surfaces. Prefer extracting a surface into its own file when a UX
change would otherwise grow this file further; keep open-flag orchestration
in `MobileShell`.

## Invariants

- Prefer authoritative sync/session state; do not invent a second mobile-only
  session source of truth.
- Capacitor vs hosted differences must stay explicit (`isCapacitorMobileApp`,
  `showCapacitorOnlyFeatures`).
- Do not reintroduce desktop context-panel rail patterns into MobileApp.
- Keyboard/focus timing in composer and `useNativeMobileChrome` is
  device-verified; change only against real hardware / simulator (see
  composer `DOCUMENTATION.md` Mobile section).
- One failed surface (files/git/mcp) must not unmount the chat column or
  clear unrelated open state.
- Locale: every new user-visible string goes through i18n (`locale-ui-patterns`).
- Theme: use existing theme tokens / components (`theme-system`).

## Validation notes for mobile UX changes

- Package checks: `bun run type-check:ui`, `bun run lint:ui`, focused tests
  under `packages/ui` for touched logic.
- Keyboard, sheet gestures, safe area, and WKWebView behavior need manual or
  simulator validation — type-check alone is insufficient.
- Native shell changes additionally need `packages/mobile` build/sync
  (see `packages/mobile/README.md`).
- Hosted preview: open Vite HMR UI and force mobile via narrow viewport +
  `'new'` layout preference, or `mobile.html` / `?surface=mobile`.

## Related docs

| Doc | Covers |
|---|---|
| `packages/mobile/README.md` | Capacitor package, commands, connection model |
| `packages/mobile/HANDOFF.md` | Native pipeline, push, widgets, store/CI gaps |
| `packages/ui/src/lib/surfaces/DOCUMENTATION.md` | Desktop context surfaces (not used here) |
| `packages/ui/src/components/chat/composer/DOCUMENTATION.md` | Composer + mobile keyboard caveats |
| `packages/docs/content/docs/mobile.mdx` | End-user install/pairing docs |
