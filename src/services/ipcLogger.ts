export interface IpcLog {
  id: string;
  timestamp: string;
  command: string;
  args: any;
  response: any;
  status: "success" | "error";
}

let logs: IpcLog[] = [];
const listeners: Set<(logs: IpcLog[]) => void> = new Set();

export function logIpc(command: string, args: any, response: any, status: "success" | "error" = "success") {
  const log: IpcLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    command, args, response, status
  };
  logs = [log, ...logs].slice(0, 100);
  listeners.forEach(cb => cb(logs));
}

export function subscribeIpcLogs(callback: (logs: IpcLog[]) => void) {
  listeners.add(callback);
  callback(logs);
  return () => { listeners.delete(callback); };
}

export function getIpcLogs() {
  return logs;
}
