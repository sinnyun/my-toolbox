import { isTauri } from "./bridge";

type EventCallback = (payload: any) => void;

class HostEventBus {
  private listeners: Map<string, EventCallback[]> = new Map();
  private unlistenFunctions: Map<string, () => void> = new Map();

  constructor() {
    // If in Tauri, initialize native listeners
    if (isTauri()) {
      this.initTauriListeners();
    }
  }

  private async initTauriListeners() {
    try {
      // @ts-ignore
      const moduleName = "@tauri-apps/api/event";
      const { listen } = await import(/* @vite-ignore */ moduleName) as any;
      // Listen to a global "tauri-event-bus" for cross-webview synchronization
      await listen("tauri-event-bus", (event: any) => {
        if (event.payload && typeof event.payload === "object") {
          const { name, payload } = event.payload;
          if (name) {
            this.triggerLocalCallbacks(name, payload);
          }
        }
      });
    } catch (err) {
      console.error("Failed to initialize Tauri native event listeners:", err);
    }
  }

  // Fire local callbacks
  private triggerLocalCallbacks(event: string, payload: any) {
    const list = this.listeners.get(event);
    if (list) {
      [...list].forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in EventBus callback for "${event}":`, e);
        }
      });
    }
  }

  // 1. Subscribe to events
  public subscribe(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    // Dynamically wire up Tauri-specific native bindings if available
    if (isTauri()) {
      this.registerTauriSpecificListener(event);
    }
  }

  private async registerTauriSpecificListener(event: string) {
    if (this.unlistenFunctions.has(event)) return;
    try {
      // @ts-ignore
      const moduleName = "@tauri-apps/api/event";
      const { listen } = await import(/* @vite-ignore */ moduleName) as any;
      const unlisten = await listen(event, (evt: any) => {
        this.triggerLocalCallbacks(event, evt.payload);
      });
      this.unlistenFunctions.set(event, unlisten);
    } catch (e) {
      console.error(`Failed to register Tauri native listener for "${event}":`, e);
    }
  }

  // 2. Unsubscribe from events
  public unsubscribe(event: string, callback: EventCallback) {
    const list = this.listeners.get(event);
    if (list) {
      const filtered = list.filter(cb => cb !== callback);
      if (filtered.length === 0) {
        this.listeners.delete(event);
        // Clean up native listener
        const unlisten = this.unlistenFunctions.get(event);
        if (unlisten) {
          unlisten();
          this.unlistenFunctions.delete(event);
        }
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  // 3. Publish events globally
  public publish(event: string, payload: any) {
    console.log(`%c[EventBus Publish] "${event}":`, "color: #3b82f6; font-weight: 600", payload);
    
    // Distribute locally within the host viewport
    this.triggerLocalCallbacks(event, payload);

    // Delegate to native Tauri process if in desktop container
    if (isTauri()) {
      this.emitTauriNative(event, payload);
    }
  }

  private async emitTauriNative(event: string, payload: any) {
    try {
      // @ts-ignore
      const moduleName = "@tauri-apps/api/event";
      const { emit } = await import(/* @vite-ignore */ moduleName) as any;
      // Fire individual channel and sync channels
      await emit(event, payload);
      await emit("tauri-event-bus", { name: event, payload });
    } catch (e) {
      console.error(`Failed to emit native Tauri event for "${event}":`, e);
    }
  }
}

export const hostEventBus = new HostEventBus();
