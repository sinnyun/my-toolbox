import React, { useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { Plugin, PluginFeature } from "../types/plugin";
import SandboxContainer from "../components/SandboxContainer";

interface HomePageProps {
  query: string;
  setQuery: (q: string) => void;
  plugins: Plugin[];
  searchResults: { plugin: Plugin; feature: PluginFeature }[];
  activePlugin: Plugin | null;
  activeFeature: PluginFeature | null;
  onRunFeature: (plugin: Plugin, feature: PluginFeature) => void;
  onExitPlugin: () => void;
}

export default function HomePage({
  query, setQuery, plugins, searchResults,
  activePlugin, activeFeature, onRunFeature, onExitPlugin
}: HomePageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activePlugin) inputRef.current?.focus();
  }, [activePlugin]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePlugin) onExitPlugin();
        else setQuery("");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [activePlugin, onExitPlugin, setQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4 pb-4">
      {/* 搜索栏 */}
      <div className="bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 px-5 py-3.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0076FF] to-[#3b82f6] flex items-center justify-center text-white font-extrabold text-base shadow-lg shadow-blue-500/20 shrink-0">
          Z
        </div>
        <Search size={16} className="text-gray-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={activePlugin ? "按 ESC 退出当前插件..." : "搜索插件... (例如 'json', 'zz', '拼音')"}
          className="flex-1 bg-transparent border-none outline-none text-[#F3F4F6] placeholder-gray-500 text-base focus:ring-0"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-gray-500 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        )}
        {activePlugin && (
          <div className="flex items-center gap-2 bg-[#0076FF]/10 text-[#0076FF] px-3 py-1 rounded-full text-xs font-semibold border border-[#0076FF]/30">
            <span>{activePlugin.logo}</span>
            <span>{activePlugin.name}</span>
            <button onClick={onExitPlugin} className="text-red-400 hover:text-red-300 ml-1 cursor-pointer">×</button>
          </div>
        )}
        <span className="text-[10px] text-gray-400 font-mono bg-[#0F0F15] px-2 py-1 rounded-md border border-[#2D2D3D]">ESC</span>
      </div>

      {/* 内容区域 */}
      {activePlugin ? (
        <div className="flex-1 min-h-0">
          <SandboxContainer activePlugin={activePlugin} activeFeature={activeFeature} onExit={onExitPlugin} />
        </div>
      ) : query ? (
        <div className="flex-1 bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] overflow-y-auto p-4 space-y-2">
          {searchResults.length > 0 ? (
            searchResults.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onRunFeature(item.plugin, item.feature)}
                className="py-3 px-4 bg-[#181822]/60 hover:bg-[#1C1C28] border border-transparent hover:border-[#0076FF]/30 rounded-xl cursor-pointer transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl bg-[#181822] w-9 h-9 rounded-lg flex items-center justify-center border border-[#2D2D3D]">
                    {item.plugin.logo}
                  </span>
                  <div>
                    <div className="font-semibold text-gray-100 text-sm group-hover:text-white">
                      {item.feature.explain}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 font-mono flex items-center gap-2">
                      <span className="text-[#0076FF]">"{query}"</span>
                      <span>·</span>
                      <span>{item.plugin.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#0076FF]/10 text-[#0076FF] group-hover:bg-[#0076FF] group-hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">
                  <span>运行</span>
                  <ArrowRight size={12} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <span className="text-3xl">🔍</span>
              <p className="text-sm text-gray-400 mt-3">未找到匹配 "<span className="text-red-400 font-mono font-semibold">{query}</span>" 的插件</p>
              <p className="text-xs text-gray-500 mt-1">试试: json, regex, clean, py</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] p-6 overflow-y-auto">
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#0076FF] to-[#3b82f6] flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/20 mb-4">
              Z
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">欢迎使用 My Toolbox</h2>
            <p className="text-sm text-gray-400">在上方搜索栏输入关键词或拼音首字母，快速启动插件工具</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {plugins.map((plugin) =>
              plugin.features.map((feat) =>
                feat.ui ? (
                  <button
                    key={feat.code}
                    onClick={() => onRunFeature(plugin, feat)}
                    style={{ borderLeft: `4px solid ${feat.ui.color}` }}
                    className="bg-[#181822]/60 hover:bg-[#1C1C28] border border-[#2D2D3D] text-white p-4 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{plugin.logo}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-200 group-hover:text-white">{feat.ui.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{plugin.name}</div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-gray-500 group-hover:text-[#0076FF] transition-colors" />
                  </button>
                ) : null
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
