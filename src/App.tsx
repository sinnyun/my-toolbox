import React, { useState, useEffect } from "react";
import { sysInvoke } from "./services/bridge";
import { hostEventBus } from "./services/eventBus";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import DebugPage from "./pages/DebugPage";
import TopNav from "./components/TopNav";
import PinyinMatch from "pinyin-match";
import { Plugin, PluginFeature } from "./types/plugin";
import { subscribeIpcLogs, IpcLog } from "./services/ipcLogger";

export type PageId = "home" | "settings" | "debug";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [query, setQuery] = useState("");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [searchResults, setSearchResults] = useState<{ plugin: Plugin; feature: PluginFeature }[]>([]);
  const [ipcLogs, setIpcLogs] = useState<IpcLog[]>([]);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const loadPlugins = () => {
    sysInvoke("get_installed_plugins").then((data) => {
      if (Array.isArray(data)) setPlugins(data);
    });
  };

  useEffect(() => {
    loadPlugins();
    hostEventBus.subscribe("plugin_registry_updated", loadPlugins);

    const unsubscribeLogs = subscribeIpcLogs((logs) => setIpcLogs(logs));

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    return () => {
      hostEventBus.unsubscribe("plugin_registry_updated", loadPlugins);
      unsubscribeLogs();
      clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results: { plugin: Plugin; feature: PluginFeature }[] = [];
    plugins.forEach((plugin) => {
      plugin.features.forEach((feat) => {
        const isMatched = feat.cmds.some((cmd) => {
          if (!cmd) return false;
          if (cmd.toLowerCase().includes(query.toLowerCase())) return true;
          try { return !!PinyinMatch.match(cmd, query); } catch { return false; }
        });
        if (isMatched) results.push({ plugin, feature: feat });
      });
    });
    setSearchResults(results);
  }, [query, plugins]);

  const handleRunFeature = (plugin: Plugin, feature: PluginFeature) => {
    if (plugin.entryType === "webview") {
      // Open plugin in a new Tauri window
      openPluginWindow(plugin);
    }
    setQuery("");
  };

  const openPluginWindow = async (plugin: Plugin) => {
    // Extract relative path: "E:/.../public/plugins/xxx/index.html" -> "plugins/xxx/index.html"
    let relPath = plugin.main;
    const publicIdx = relPath.indexOf("/public/");
    if (publicIdx !== -1) {
      relPath = relPath.substring(publicIdx + 8);
    }
    try {
      await sysInvoke("open_plugin_window", {
        pluginId: plugin.id,
        title: plugin.name,
        url: `http://localhost:3000/${relPath}`
      });
    } catch (err) {
      console.error("Failed to open plugin window:", err);
    }
  };

  return (
    <div className="h-screen w-full bg-[#070709] text-[#E0E0E6] flex flex-col overflow-hidden font-sans">
      <div className="absolute top-[-30%] left-[20%] w-[60%] h-[50%] rounded-full bg-[#0076FF]/5 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>

      <header className="w-full max-w-4xl mx-auto flex items-center justify-between px-6 pt-4 pb-2 text-xs font-mono text-gray-500 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-gray-400 font-medium">My Toolbox</span>
          <TopNav currentPage={currentPage} onNavigate={setCurrentPage} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500">{currentDate}</span>
          <span>{currentTime}</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col z-10 min-h-0 px-6">
        {currentPage === "home" && (
          <HomePage
            query={query}
            setQuery={setQuery}
            plugins={plugins}
            searchResults={searchResults}
            onRunFeature={handleRunFeature}
          />
        )}
        {currentPage === "settings" && (
          <SettingsPage plugins={plugins} />
        )}
        {currentPage === "debug" && (
          <DebugPage ipcLogs={ipcLogs} />
        )}
      </main>
    </div>
  );
}
