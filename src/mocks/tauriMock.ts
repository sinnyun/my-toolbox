import { Plugin } from "../types/plugin";

// 1. Initial list of high-fidelity mock plugins
const DEFAULT_PLUGINS: Plugin[] = [
  {
    id: "my-toolbox-clipboard-clean",
    name: "Clipboard Purifier",
    version: "1.1.0",
    logo: "🧼",
    entryType: "panel",
    main: "",
    features: [{
      code: "panel_clean_space",
      explain: "Purges excess tabs, double spaces, and newlines from the clipboard.",
      cmds: ["clean", "purify", "trim", "jh", "净化剪贴板", "qm"],
      ui: {
        displayType: "button",
        label: "Purify Spaces",
        icon: "Sparkles",
        color: "#10b981"
      }
    }]
  },
  {
    id: "my-toolbox-pinyin-converter",
    name: "Pinyin Helper",
    version: "1.0.0",
    logo: "🀄",
    entryType: "panel",
    main: "",
    features: [{
      code: "panel_pinyin_convert",
      explain: "Convert Chinese characters to standard Pinyin representations.",
      cmds: ["pinyin", "py", "hz", "拼音转换", "pyzh"],
      ui: {
        displayType: "button",
        label: "Convert to Pinyin",
        icon: "Languages",
        color: "#8b5cf6"
      }
    }]
  },
  {
    id: "my-toolbox-json-format",
    name: "JSON Formatter",
    version: "1.2.0",
    logo: "📦",
    entryType: "webview",
    main: "plugins/json-format/index.html",
    features: [{
      code: "format_page",
      explain: "Launch the JSON formatter, beautifier, and validation suite.",
      cmds: ["json", "format", "beautify", "格式化", "gsh"],
      ui: {
        displayType: "button",
        label: "JSON Formatter",
        icon: "Code2",
        color: "#3b82f6"
      }
    }]
  },
  {
    id: "my-toolbox-regex-helper",
    name: "Regex Sandbox",
    version: "1.0.0",
    logo: "🔍",
    entryType: "webview",
    main: "plugins/regex-helper/index.html",
    features: [{
      code: "regex_page",
      explain: "Test, generate, and store commonly used regex equations.",
      cmds: ["regex", "test", "helper", "正则", "zz"],
      ui: {
        displayType: "button",
        label: "Regex Tester",
        icon: "FileSearch",
        color: "#f59e0b"
      }
    }]
  }
];

// Initialize localstorage with default plugins list
if (typeof window !== "undefined" && !localStorage.getItem("my-toolbox_installed_plugins")) {
  localStorage.setItem("my-toolbox_installed_plugins", JSON.stringify(DEFAULT_PLUGINS));
}

// 2. Database sandbox with partition namespace isolation
const mockDatabase = {
  put: (pluginId: string, key: string, value: any) => {
    const namespaceKey = `plugin_isolated:${pluginId}:${key}`;
    localStorage.setItem(namespaceKey, JSON.stringify(value));
    console.log(`%c[Sled DB Isolated Put] ${pluginId} ➜ "${key}":`, "color: #10b981", value);
  },
  get: (pluginId: string, key: string): any => {
    const namespaceKey = `plugin_isolated:${pluginId}:${key}`;
    const data = localStorage.getItem(namespaceKey);
    const parsed = data ? JSON.parse(data) : null;
    console.log(`%c[Sled DB Isolated Get] ${pluginId} ➜ "${key}":`, "color: #3b82f6", parsed);
    return parsed;
  },
  remove: (pluginId: string, key: string) => {
    const namespaceKey = `plugin_isolated:${pluginId}:${key}`;
    localStorage.removeItem(namespaceKey);
    console.log(`%c[Sled DB Isolated Delete] ${pluginId} ➜ "${key}"`, "color: #ef4444");
  }
};

// 3. Keep logs of the bridge activities so users can inspect full fidelity
export interface IpcCallLog {
  id: string;
  timestamp: string;
  command: string;
  args: any;
  response: any;
  status: "success" | "error";
}

let ipcLogs: IpcCallLog[] = [];
const listeners: Set<(logs: IpcCallLog[]) => void> = new Set();

const addIpcLog = (command: string, args: any, response: any, status: "success" | "error" = "success") => {
  const log: IpcCallLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    command,
    args,
    response,
    status
  };
  ipcLogs = [log, ...ipcLogs].slice(0, 50); // Keep last 50 logs
  listeners.forEach(cb => cb(ipcLogs));
};

export const subscribeToIpcLogs = (callback: (logs: IpcCallLog[]) => void) => {
  listeners.add(callback);
  callback(ipcLogs);
  return () => {
    listeners.delete(callback);
  };
};

// 4. Mock IPC distribution router
export const mockInvoke = async (command: string, args: any = {}): Promise<any> => {
  // Simulate low network/IPC latency
  await new Promise(resolve => setTimeout(resolve, 80));

  try {
    switch (command) {
      case "get_installed_plugins": {
        const stored = localStorage.getItem("my-toolbox_installed_plugins");
        const res = stored ? JSON.parse(stored) : DEFAULT_PLUGINS;
        addIpcLog(command, args, res);
        return res;
      }
      
      case "install_plugin": {
        const stored = localStorage.getItem("my-toolbox_installed_plugins");
        const list: Plugin[] = stored ? JSON.parse(stored) : [...DEFAULT_PLUGINS];
        const newPlugin: Plugin = args.plugin;
        
        // Remove existing plugin of same ID if any
        const filtered = list.filter(p => p.id !== newPlugin.id);
        const updated = [...filtered, newPlugin];
        localStorage.setItem("my-toolbox_installed_plugins", JSON.stringify(updated));
        
        addIpcLog(command, args, { success: true });
        return { success: true, plugins: updated };
      }

      case "uninstall_plugin": {
        const stored = localStorage.getItem("my-toolbox_installed_plugins");
        const list: Plugin[] = stored ? JSON.parse(stored) : [...DEFAULT_PLUGINS];
        const updated = list.filter(p => p.id !== args.pluginId);
        localStorage.setItem("my-toolbox_installed_plugins", JSON.stringify(updated));
        
        addIpcLog(command, args, { success: true });
        return { success: true, plugins: updated };
      }
        
      case "plugin_db_put": {
        const { pluginId, key, value } = args;
        mockDatabase.put(pluginId, key, value);
        addIpcLog(command, args, { success: true });
        return { success: true };
      }
        
      case "plugin_db_get": {
        const { pluginId, key } = args;
        const val = mockDatabase.get(pluginId, key);
        addIpcLog(command, args, val);
        return val;
      }

      case "plugin_db_remove": {
        const { pluginId, key } = args;
        mockDatabase.remove(pluginId, key);
        addIpcLog(command, args, { success: true });
        return { success: true };
      }
      
      case "open_native_url": {
        window.open(args.url, "_blank");
        addIpcLog(command, args, true);
        return true;
      }

      case "mount_webview_plugin": {
        addIpcLog(command, args, { status: "mounted_placeholder_webview" });
        return { success: true };
      }

      case "destroy_webview_plugin": {
        addIpcLog(command, args, { status: "destroyed_placeholder_webview" });
        return { success: true };
      }

      default:
        throw new Error(`Command "${command}" is not implemented in mock framework.`);
    }
  } catch (error: any) {
    addIpcLog(command, args, error.message || error, "error");
    throw error;
  }
};
