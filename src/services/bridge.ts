import { logIpc } from "./ipcLogger";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
};

export const sysInvoke = async (command: string, args: any = {}): Promise<any> => {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke(command, args);
    logIpc(command, args, result, "success");
    return result;
  } catch (err: any) {
    logIpc(command, args, err.message || err, "error");
    throw err;
  }
};
