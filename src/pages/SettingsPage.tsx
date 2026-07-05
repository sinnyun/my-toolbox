import React, { useState, useEffect } from "react";
import { sysInvoke, isTauri } from "../services/bridge";
import { hostEventBus } from "../services/eventBus";
import { Plugin } from "../types/plugin";
import {
  Settings, Puzzle, Database, Trash2, RefreshCw, Palette, Info
} from "lucide-react";

interface SettingsPageProps {
  plugins: Plugin[];
}

type SettingsSection = "plugins" | "storage" | "appearance" | "about";

const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "plugins", label: "插件管理", icon: <Puzzle size={16} /> },
  { id: "storage", label: "数据存储", icon: <Database size={16} /> },
  { id: "appearance", label: "外观设置", icon: <Palette size={16} /> },
  { id: "about", label: "关于", icon: <Info size={16} /> },
];

export default function SettingsPage({ plugins }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("plugins");
  const [dbKeys, setDbKeys] = useState<{ pluginId: string; key: string; value: string }[]>([]);

  const refreshDbKeys = async () => {
    try {
      const result = await sysInvoke("list_db_keys");
      if (Array.isArray(result)) setDbKeys(result);
    } catch (err) {
      console.error("Failed to list db keys:", err);
    }
  };

  useEffect(() => { refreshDbKeys(); }, []);

  const handleDeleteKey = async (pluginId: string, key: string) => {
    await sysInvoke("plugin_db_remove", { pluginId, key });
    refreshDbKeys();
  };

  const handleUninstall = async (pluginId: string) => {
    await sysInvoke("uninstall_plugin", { pluginId });
    hostEventBus.publish("plugin_registry_updated", {});
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      <div className="w-52 bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] p-3 flex flex-col shrink-0">
        <div className="px-3 py-2 mb-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Settings size={13} />
            设置
          </h3>
        </div>
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeSection === s.id
                  ? "bg-[#0076FF]/10 text-[#0076FF] border border-[#0076FF]/20"
                  : "text-gray-400 hover:text-white hover:bg-[#1C1C24] border border-transparent"
              }`}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] p-5 overflow-y-auto min-h-0">
        {activeSection === "plugins" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">已安装插件 ({plugins.length})</h2>
            </div>
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <div key={plugin.id} className="bg-[#181822] border border-[#2D2D3D] rounded-xl p-4 flex items-center justify-between hover:border-gray-600 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl bg-[#0F0F15] w-10 h-10 rounded-xl flex items-center justify-center border border-[#2D2D3D]">{plugin.logo}</span>
                    <div>
                      <div className="font-semibold text-gray-200 text-sm">{plugin.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                        <span className="font-mono bg-[#0F0F15] px-1.5 py-0.5 rounded border border-[#2D2D3D] text-blue-400">{plugin.id}</span>
                        <span>v{plugin.version}</span>
                        <span>·</span>
                        <span>{plugin.entryType === "webview" ? "独立沙箱" : "原生面板"}</span>
                      </div>
                    </div>
                  </div>
                  {plugin.id.startsWith("my-toolbox-") ? (
                    <span className="text-[10px] text-[#0076FF] bg-[#0076FF]/10 border border-blue-500/20 px-2.5 py-1 rounded-md font-bold uppercase">内置</span>
                  ) : (
                    <button onClick={() => handleUninstall(plugin.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-2 rounded-lg cursor-pointer transition-all" title="卸载">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "storage" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">沙箱隔离存储 ({dbKeys.length})</h2>
              <button onClick={refreshDbKeys} className="text-xs text-[#0076FF] hover:underline flex items-center gap-1 cursor-pointer">
                <RefreshCw size={12} /> 刷新
              </button>
            </div>
            <div className="bg-[#0F0F15] border border-[#2D2D3D] rounded-xl p-3 text-xs text-gray-400 leading-relaxed">
              <strong>隔离规则:</strong> 每个插件的 Key 自动添加 <code className="bg-[#181822] px-1.5 py-0.5 text-[#0076FF] rounded font-mono">plugin_isolated:{'{pluginId}'}:</code> 前缀，确保命名空间完全隔离。
            </div>
            {dbKeys.length > 0 ? (
              <div className="space-y-2">
                {dbKeys.map((item, idx) => (
                  <div key={idx} className="bg-[#181822] border border-[#2D2D3D] rounded-xl p-3 flex items-center justify-between hover:border-gray-600 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono text-[#0076FF] bg-[#0076FF]/10 px-2 py-0.5 rounded border border-blue-500/20 shrink-0">{item.pluginId}</span>
                      <span className="text-xs text-gray-300 font-mono truncate">"{item.key}"</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-xs text-emerald-400 font-mono truncate" title={item.value}>{item.value}</span>
                    </div>
                    <button onClick={() => handleDeleteKey(item.pluginId, item.key)} className="text-gray-500 hover:text-red-400 p-1 cursor-pointer shrink-0 ml-2">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#0F0F15] rounded-2xl border border-dashed border-[#2D2D3D]">
                <Database size={28} className="mx-auto text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">暂无存储数据</p>
                <p className="text-xs text-gray-500 mt-1">使用插件后会产生隔离数据</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "appearance" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">外观设置</h2>
            <div className="bg-[#181822] border border-[#2D2D3D] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-200 font-medium">主题模式</div>
                  <div className="text-xs text-gray-500 mt-0.5">当前: 深色模式 (Midnight Onyx)</div>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#070709] border-2 border-[#0076FF] cursor-pointer"></div>
                  <div className="w-8 h-8 rounded-lg bg-gray-200 border border-[#2D2D3D] cursor-pointer opacity-40"></div>
                </div>
              </div>
              <div className="border-t border-[#2D2D3D] pt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-200 font-medium">字体大小</div>
                  <div className="text-xs text-gray-500 mt-0.5">界面文字显示大小</div>
                </div>
                <span className="text-xs text-gray-400 bg-[#0F0F15] px-3 py-1.5 rounded-lg border border-[#2D2D3D]">默认</span>
              </div>
            </div>
          </div>
        )}

        {activeSection === "about" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">关于 My Toolbox</h2>
            <div className="bg-[#181822] border border-[#2D2D3D] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0076FF] to-[#3b82f6] flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>
                <div>
                  <div className="text-base font-semibold text-white">My Toolbox Desktop</div>
                  <div className="text-xs text-gray-400">v0.1.0 · 高保真桌面工具箱</div>
                </div>
              </div>
              <div className="border-t border-[#2D2D3D] pt-4 text-xs text-gray-400 leading-relaxed space-y-2">
                <p>My Toolbox 是一个受 uTools 启发的高保真桌面工具箱平台，支持多沙箱隔离运行、动态插件热插拔。</p>
                <p><strong className="text-gray-300">技术栈:</strong> React + TypeScript + Vite + Tauri v2 + Tailwind CSS</p>
                <p><strong className="text-gray-300">运行环境:</strong> Tauri 原生桌面 (Rust 后端)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
