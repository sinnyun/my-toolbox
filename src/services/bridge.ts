import { mockInvoke } from "../mocks/tauriMock";

// Detect if running in desktop tauri native environment
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
};

// Adapter Pattern: dispatch to native Tauri core v2 or mock simulation
export const sysInvoke = async (command: string, args: any = {}): Promise<any> => {
  if (isTauri()) {
    try {
      // Zero-modification porting using lazy/dynamic imports
      // @ts-ignore
      const moduleName = "@tauri-apps/api/core";
      const { invoke } = await import(/* @vite-ignore */ moduleName) as any;
      return await invoke(command, args);
    } catch (err) {
      console.error("Tauri core invoke failed, falling back to browser mock simulation:", err);
      return mockInvoke(command, args);
    }
  } else {
    return mockInvoke(command, args);
  }
};
