type EventCallback = (payload: any) => void;

class HostEventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  private triggerCallbacks(event: string, payload: any) {
    const list = this.listeners.get(event);
    if (list) {
      [...list].forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[EventBus] Error in callback for "${event}":`, e);
        }
      });
    }
  }

  subscribe(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  unsubscribe(event: string, callback: EventCallback) {
    const list = this.listeners.get(event);
    if (list) {
      const filtered = list.filter(cb => cb !== callback);
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  publish(event: string, payload: any) {
    this.triggerCallbacks(event, payload);
  }
}

export const hostEventBus = new HostEventBus();
