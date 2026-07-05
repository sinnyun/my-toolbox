# My Toolbox (uTools-like) Codebase Development & Agent Guidelines

This document establishes the official development standards, user experience rules, and coding constraints for **My Toolbox** (the uTools-inspired high-fidelity desktop toolkit). Any agent or developer modifying this repository **MUST** strictly adhere to this specification to preserve architectural integrity, premium minimalist style, and performance.

---

## 1. Visual & UX Standards (uTools Philosophy)

My Toolbox replicates the clean, minimalist, high-productivity aesthetic of **uTools**. We focus on speed, negative space, and typographic hierarchy.

### 🎨 The "Midnight Onyx" Color Theme
Always use deep, rich charcoal, obsidian, and slate tones instead of generic bright blue/purple gradients:
- **Application Background**: `#070709` (pure near-black)
- **Active Container Card**: `#121218` or `#121218/95` backdrop blur
- **Input Header / Floating Panel**: `#181822` with high-contrast subtle border `#2D2D3D`
- **Text Accents**: Tailwind's Emerald (`#10b981`), Mint (`#a7f3d0`), or uTools blue (`#0076FF`).

### ⌨️ Input-Centric Flow (Zero-Click Initiation)
- **Central Search Bar**: The top-level input is the focal point of the app. It must immediately autofocus upon mount or view-switching.
- **Hotkey & Esc Handler**: Pressing `ESC` from any state **must** close the active plugin, clear the query input, and return the user to the default Search/Dashboard view.
- **Pinyin Matching Support**: Users can search utilizing Chinese Characters, complete pinyin, or initial letter shortcuts (e.g., searching "gsh" or "json" matches the JSON Formatter; searching "zz" or "regex" matches Regex Helper).

---

## 2. Technical Stack & Coding Guidelines

### ⚛️ React & State Management
- **No Infinite Re-renders**: Avoid updating state directly inside a render cycle. Keep `useEffect` dependency arrays strictly limited to primitive types (strings, booleans, numbers) or heavily memoized hooks.
- **Component Splitting**: Do not put massive markup blocks in single files. Outsource isolated widgets (such as the main Dashboard panels or sandbox HTML templates) into modular structures under `src/components/` or config files.
- **SVG Handling**: All visual icons must be imported from `lucide-react`. Do not write raw `<svg>` structures inline.

### 🏷️ TypeScript & Type Safety
- **Named Imports Only**: Always use named import statements (`import { isTauri } from "./bridge"`) at the top of files. Do not use generic object destructuring.
- **Standard Enums**: Use standard `enum` definitions rather than `const enum` to prevent bundle-level compilation inconsistencies.
- **Strict Typing**: Avoid assigning things to `any` unless writing bridge/mock adapters that handle dynamic JSON schemas from external sandbox payloads.

### ⚙️ Build and Portability Rules
- **Desktop/Browser Dual Core**: The codebase must run seamlessly both in standard browsers (simulated memory/LocalStorage) and inside a compiled native desktop app running on **Tauri v2**.
- **The Adapter Pattern**: All system commands must call `sysInvoke()` inside `src/services/bridge.ts`, which safely checks if Tauri native bindings (`window.__TAURI_INTERNALS__`) are available. If not, it gracefully degrades to simulated IPC handlers inside `src/mocks/tauriMock.ts`.

---

## 3. Storage & Data Persistence

### 🛡️ Sled DB Sandbox Isolation
To prevent sandboxed plugins from tampering with system databases or other plugins:
- All guest storage calls **MUST** pass through the bridge database handlers (`plugin_db_put`, `plugin_db_get`, `plugin_db_remove`).
- Behind the scenes, keys are automatically namespace-prefixed as:
  ```ts
  const namespaceKey = `plugin_isolated:${pluginId}:${key}`;
  ```
- No plugin should ever access `localStorage` directly in a sandboxed iframe. Doing so breaches safety borders.

---

## 4. Documentation & Maintenance
Whenever a new feature is added, or a plugin is introduced:
1. Declare its schema in `src/types/plugin.ts`.
2. Append it to `DEFAULT_PLUGINS` inside `src/mocks/tauriMock.ts`.
3. Log any newly introduced IPC commands in the simulated router router.
