# My Toolbox Core Architecture & Framework Guide

Welcome to the **My Toolbox** framework documentation. My Toolbox is a micro-kernel desktop utility ecosystem built with **React, Vite, TypeScript, Tailwind CSS**, and designed for cross-compilation with the **Tauri v2** native desktop runtime. 

This document serves as an exhaustive guide to the My Toolbox architectural mechanics, sandbox isolation borders, and communication protocols.

---

## 1. System Architecture Blueprint

My Toolbox splits the application state into two isolated contexts: **The Host Environment (Control Plane)** and **The Sandbox Guest Environment (Data/Process Plane)**.

```
┌────────────────────────────────────────────────────────┐
│                        Tauri / Rust Host               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────┐  │
│  │  PluginRegistry │  │  Rust Event Bus  │  │ Sled DB│  │
│  └────────┬────────┘  └────────┬─────────┘  └───┬────┘  │
└───────────┼────────────────────┼────────────────┼──────┘
            │ 动态注册            │ 事件发布        │ 隔离读写
            ▼                    ▼                ▼
┌────────────────────────────────────────────────────────┐
│                      Host UI (React)                   │
│  ┌────────────────────────┐  ┌───────────────────────┐ │
│  │ 默认面板 (Dashboard)     │  │  Host Event Bus (JS)  │ │
│  │ (注入系统/面板插件按钮)   │  │  (协调内置与外置插件) │ │
│  └──────────┬─────────────┘  └───────────┬───────────┘ │
└─────────────┼────────────────────────────┼─────────────┘
              │ (动态渲染/挂载)            │ (事件订阅/发布)
              ▼                            ▼
   ┌──────────────────────┐     ┌──────────────────────┐
   │ 方案 A: 内部面板插件   │     │ 方案 B: 独立页面插件   │
   │ (React Component)    │     │ (Webview 沙箱)       │
   └──────────────────────┘     └──────────────────────┘
```

---

## 2. Directory Structure Map

Below is a map of the core files and services that make up the My Toolbox workspace:

```
src/
├── App.tsx                    # Main host window, query controller & search input
├── main.tsx                   # Application entry point
├── index.css                  # Global Tailwind styling (Onyx design theme override)
├── types/
│   └── plugin.ts              # Declarations of Plugin, PluginFeature, and UI properties
├── services/
│   ├── bridge.ts              # Adaptive IPC Dispatcher (Tauri Rust API ⇆ Browser mock)
│   └── eventBus.ts            # Bidirectional cross-frame Event Bus listener
├── mocks/
│   └── tauriMock.ts           # Mock Sled DB database, plugin register, and IPC telemetry log
└── components/
    ├── Dashboard.tsx          # Panel plugins (Clipboard Purifier, Pinyin Helper) & Search
    └── SandboxContainer.tsx   # Iframe container injecting custom iframe webview guest sandboxes
```

---

## 3. Host and Guest Sandbox Isolation (The Bridge Interface)

My Toolbox embeds untrusted, heavy, or volatile plugins inside HTML Webviews (iframes in the browser / native isolated webviews in Tauri). These sandboxes cannot touch `window.parent`, local storage, or system APIs directly. Communication is purely mediated by a **Preload Bridge**.

### 🔗 Preload Bridge Injection (`window.myToolbox`)
When a sandbox loads, `SandboxContainer.tsx` intercepts the iframe loading cycle and exposes an API wrapper `window.myToolbox` directly into the iframe's global window scope. 

The sandboxed page interacts with the operating system using these exposed endpoints:

```javascript
// Guest Sandbox JS API Reference
window.myToolbox = {
  // 1. Isolated persistent database (Namespace Isolated Key-Value Storage)
  db: {
    put: async (key, val) => { ... },     // Stores a key under the plugin's namespace
    get: async (key) => { ... },          // Retrieves a value safely
    remove: async (key) => { ... }        // Deletes a value
  },
  
  // 2. Publish messaging to the main host EventBus
  publish: (event, payload) => { ... },
  
  // 3. Immediately exit the active sandbox plugin
  exit: () => { ... }
};
```

### ⏳ The Guest Lifecycle hook (`window.onMyToolboxReady`)
Since dynamic bridge injection takes a few milliseconds, guest code **must** define a hook to start executing commands:

```javascript
window.onMyToolboxReady = async () => {
  console.log("Bridge connected!");
  const lastText = await window.myToolbox.db.get("saved_session");
  // Execute plugin code safely here...
};
```

---

## 4. Key Services & Communication Channels

### 📡 The Host Event Bus (`src/services/eventBus.ts`)
The `HostEventBus` class acts as the centralized nervous system of the platform. It handles local React callbacks and redirects them to Rust/Tauri native listeners when packaged.

- **`subscribe(event, callback)`**: Registers a callback for a specific channel.
- **`publish(event, payload)`**: Broadcasts events. For example, when a guest plugin formats a JSON string, it publishes a `clipboard_update` event:
  ```javascript
  window.myToolbox.publish('clipboard_update', { text: formattedJson });
  ```
  The host listens to `clipboard_update` and syncs it with the host input / pasteboard state immediately.

### 💾 Simulated "Sled DB" Micro-database (`src/mocks/tauriMock.ts`)
Sled DB is a lightweight, embedded Rust database. In our development environment, Sled DB's partition isolation is simulated via browser `localStorage` namespaces:
- Prefixes keys with `plugin_isolated:<pluginId>:<key>` to prevent Cross-site / Cross-plugin pollution.
- Persisted states are instantly visible under the "Sled DB" or "IPC Telemetry" panels for interactive inspection.

---

## 5. Developer Onboarding: Creating a Plugin

### Option A: Creating a Panel Plugin (React Context)
Best for light, fast utilities.
1. Design your UI as a React component under `src/components/Dashboard.tsx`.
2. Add a unique action handler linked to your feature's `code` (e.g., `panel_clean_space`).
3. Bind inputs to standard react state, keeping operations client-side.

### Option B: Creating a Webview Sandbox Plugin (Isolated Webview)
Best for third-party scripts, rich utilities, or performance-isolated modules.
1. Write a self-contained HTML/JS bundle (such as our Markdown parser, Regex helper, or JSON Formatter).
2. Embed the source code directly inside `src/components/SandboxContainer.tsx` using the iframe `srcDoc` injector template.
3. Access user input via `window.myToolbox.db` and output results via `window.myToolbox.publish('clipboard_update', ...)`.
