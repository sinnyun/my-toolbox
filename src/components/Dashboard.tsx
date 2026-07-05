import React, { useEffect, useState } from "react";
import { hostEventBus } from "../services/eventBus";
import { sysInvoke } from "../services/bridge";
import { Plugin, PluginFeature } from "../types/plugin";
import { 
  Sparkles, 
  Languages, 
  Database, 
  Plus, 
  Trash2, 
  Cpu, 
  ArrowRight, 
  Check, 
  Copy, 
  Code2, 
  FileSearch,
  Layers,
  Terminal,
  Activity
} from "lucide-react";

interface DashboardProps {
  plugins: Plugin[];
  searchResults: { plugin: Plugin; feature: PluginFeature }[];
  onRunFeature: (plugin: Plugin, feature: PluginFeature) => void;
  query: string;
}

export default function Dashboard({ plugins, searchResults, onRunFeature, query }: DashboardProps) {
  // Panel state
  const [purifyCount, setPurifyCount] = useState(0);
  const [pinyinText, setPinyinText] = useState("你好，这里是 my-toolbox 拼音助手测试。");
  const [pinyinOutput, setPinyinOutput] = useState("");
  const [isolatedDbKeys, setIsolatedDbKeys] = useState<{ pluginId: string; key: string; value: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"widgets" | "database" | "plugins">("widgets");
  
  // Custom plugin creator form
  const [isCreatingPlugin, setIsCreatingPlugin] = useState(false);
  const [newPluginId, setNewPluginId] = useState("custom-uuid-tool");
  const [newPluginName, setNewPluginName] = useState("Regex Cheat Sheet");
  const [newPluginType, setNewPluginType] = useState<"panel" | "webview">("webview");
  const [newPluginLogo, setNewPluginLogo] = useState("📋");
  const [newFeatureCmd, setNewFeatureCmd] = useState("cheat");
  const [newFeatureExplain, setNewFeatureExplain] = useState("Quick regular expression snippets.");
  
  // Feedback messages
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);

  // Common Chinese character Pinyin dictionary for realistic simulation
  const PINYIN_DICT: Record<string, string> = {
    "你": "nǐ", "好": "hǎo", "世": "shì", "界": "jiè", "简": "jiǎn", "单": "dān",
    "工": "gōng", "具": "jù", "拼": "pīn", "音": "yīn", "测": "cè", "试": "shì",
    "剪": "jiǎn", "贴": "tiē", "板": "bǎn", "净": "jìng", "化": "huà", "格": "gé",
    "式": "shì", "数": "shù", "据": "jù", "库": "kù", "隔": "gé", "离": "lí",
    "系": "xì", "统": "tǒng", "助": "zhù", "手": "shǒu", "开": "kāi", "发": "fā",
    "平": "píng", "台": "tái", "联": "lián", "合": "hé", "运": "yùn", "行": "xíng"
  };

  // Convert text to pinyin
  const handlePinyinConversion = (input: string) => {
    const chars = input.split("");
    const result = chars.map(char => {
      if (PINYIN_DICT[char]) {
        return PINYIN_DICT[char];
      }
      // Simple fallback converter for basic letters/symbols
      if (/[a-zA-Z0-9]/.test(char)) return char;
      if (/\s/.test(char)) return " ";
      // Return character with subtle sound mark for simulation
      return char;
    }).join(" ");
    
    const formatted = result.replace(/\s+/g, " ").trim();
    setPinyinOutput(formatted);

    // Save history isolated in DB
    sysInvoke("plugin_db_put", {
      pluginId: "my-toolbox-pinyin-converter",
      key: "last_conversion",
      value: { input, output: formatted, time: new Date().toLocaleTimeString() }
    }).then(() => refreshIsolatedKeys());
  };

  // Fetch the isolated database keys from localStorage for inspecting
  const refreshIsolatedKeys = () => {
    const keys: { pluginId: string; key: string; value: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith("plugin_isolated:")) {
        // Format: plugin_isolated:pluginId:key
        const parts = storageKey.split(":");
        const pluginId = parts[1];
        const key = parts.slice(2).join(":");
        const rawVal = localStorage.getItem(storageKey) || "";
        keys.push({ pluginId, key, value: rawVal });
      }
    }
    setIsolatedDbKeys(keys);
  };

  useEffect(() => {
    refreshIsolatedKeys();
  }, []);

  // Set up listeners for the Clipboard Purifier command
  useEffect(() => {
    const handlePurifyCommand = (payload: any) => {
      if (payload.code === "panel_clean_space") {
        // Read current clipboard via event subscription
        hostEventBus.subscribe("clipboard_update", function once(clipPayload) {
          // Purify spaces, tabs and linebreaks
          const cleanedText = clipPayload.text.replace(/\s+/g, "");
          hostEventBus.publish("clipboard_update", { text: cleanedText });
          
          setPurifyCount(c => c + 1);
          setClipboardFeedback("Clipboard whitespace successfully purified!");
          setTimeout(() => setClipboardFeedback(null), 3000);
          
          // Save telemetry log inside isolated db
          sysInvoke("plugin_db_put", {
            pluginId: "my-toolbox-clipboard-clean",
            key: "last_cleaned_text",
            value: { original: clipPayload.text, cleaned: cleanedText, timestamp: new Date().toLocaleTimeString() }
          }).then(() => refreshIsolatedKeys());

          hostEventBus.unsubscribe("clipboard_update", once);
        });

        // Trigger mock clipboard update event to read current value
        hostEventBus.publish("clipboard_update", { text: "   Cleaned   Text \r\n Tabs   and   Returns   Gone!  " });
      }
    };

    const handlePinyinCommand = (payload: any) => {
      if (payload.code === "panel_pinyin_convert") {
        handlePinyinConversion(pinyinText);
        setClipboardFeedback("Text converted to Pinyin below!");
        setTimeout(() => setClipboardFeedback(null), 3000);
      }
    };

    hostEventBus.subscribe("panel_command:my-toolbox-clipboard-clean", handlePurifyCommand);
    hostEventBus.subscribe("panel_command:my-toolbox-pinyin-converter", handlePinyinCommand);

    return () => {
      hostEventBus.unsubscribe("panel_command:my-toolbox-clipboard-clean", handlePurifyCommand);
      hostEventBus.unsubscribe("panel_command:my-toolbox-pinyin-converter", handlePinyinCommand);
    };
  }, [pinyinText]);

  // Create customized plugin
  const handleCreatePlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPluginId.trim() || !newPluginName.trim() || !newFeatureCmd.trim()) return;

    const newPlugin: Plugin = {
      id: newPluginId,
      name: newPluginName,
      version: "1.0.0",
      logo: newPluginLogo,
      entryType: newPluginType,
      main: newPluginType === "webview" ? "plugins/custom-tool/index.html" : "",
      features: [
        {
          code: `custom_${newFeatureCmd}`,
          explain: newFeatureExplain,
          cmds: [newFeatureCmd.toLowerCase(), "custom"],
          ui: {
            displayType: "button",
            label: newPluginName,
            icon: newPluginType === "webview" ? "Code2" : "Sparkles",
            color: "#ec4899"
          }
        }
      ]
    };

    await sysInvoke("install_plugin", { plugin: newPlugin });
    // Force App.tsx to reload list by firing an event
    hostEventBus.publish("plugin_registry_updated", {});
    
    setIsCreatingPlugin(false);
    setNewPluginId("custom-" + Math.random().toString(36).substring(4, 8));
    setNewPluginName("");
    setNewFeatureCmd("");
    setNewFeatureExplain("");
    setClipboardFeedback(`Plugin "${newPluginName}" dynamically registered!`);
    setTimeout(() => setClipboardFeedback(null), 3500);
  };

  // Uninstall plugin
  const handleUninstall = async (pluginId: string) => {
    await sysInvoke("uninstall_plugin", { pluginId });
    hostEventBus.publish("plugin_registry_updated", {});
    setClipboardFeedback("Plugin uninstalled successfully.");
    setTimeout(() => setClipboardFeedback(null), 3000);
  };

  // Delete storage key
  const handleDeleteStorageKey = async (pluginId: string, key: string) => {
    await sysInvoke("plugin_db_remove", { pluginId, key });
    refreshIsolatedKeys();
  };

  // Get matching Lucide icon Component
  const renderIcon = (name: string) => {
    switch (name) {
      case "Sparkles": return <Sparkles size={16} />;
      case "Languages": return <Languages size={16} />;
      case "Code2": return <Code2 size={16} />;
      case "FileSearch": return <FileSearch size={16} />;
      default: return <Cpu size={16} />;
    }
  };

  return (
    <div id="my-toolbox-dashboard" className="flex-1 bg-[#121218] rounded-2xl border border-[#2D2D3D] overflow-hidden flex flex-col shadow-inner">
      {/* 模糊检索结果或标签内容 */}
      {query ? (
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 mb-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <Activity size={12} className="text-[#0076FF] animate-pulse" />
            <span>uTools 匹配结果 ({searchResults.length})</span>
          </div>
          
          {searchResults.length > 0 ? (
            <div className="space-y-1.5">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  id={`search-result-${item.plugin.id}`}
                  onClick={() => onRunFeature(item.plugin, item.feature)}
                  className="py-2.5 px-3.5 bg-[#181822]/40 hover:bg-[#1C1C28] border border-transparent hover:border-[#0076FF]/35 rounded-xl cursor-pointer transition-all duration-150 group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl bg-[#181822] w-8 h-8 rounded-lg flex items-center justify-center border border-[#2D2D3D] shadow-sm">
                      {item.plugin.logo}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-100 text-[13px] tracking-wide group-hover:text-white flex items-center gap-2">
                        <span>{item.feature.explain === "Beautify and query JSON string payloads." ? "美化排版与过滤查询 JSON 数据" : 
                               item.feature.explain === "Match expression validator suite." ? "正则表达式匹配及辅助提取工具" : item.feature.explain}</span>
                        <span className="text-[10px] bg-[#0076FF]/10 text-[#0076FF] px-1.5 py-0.2 rounded font-mono border border-blue-500/10">
                          {item.plugin.name === "JSON Formatter" ? "内置沙箱" : item.plugin.name === "Regex Helper" ? "内置沙箱" : "轻量插件"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5 font-mono">
                        <span className="text-gray-500">关键字:</span>
                        <span className="text-[#0076FF] font-bold bg-[#0076FF]/5 px-1 rounded">"{query}"</span>
                        <span>•</span>
                        <span className="text-gray-500">主入口:</span>
                        <span className="text-gray-300">{item.plugin.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0076FF]/10 text-[#0076FF] group-hover:bg-[#0076FF] group-hover:text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm">
                    <span>运行</span>
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#0F0F15] rounded-xl border border-dashed border-[#2D2D3D]">
              <span className="text-xl">🔍</span>
              <p className="text-xs text-gray-400 mt-2">未找到与 <span className="text-red-400 font-mono font-semibold">"{query}"</span> 匹配的插件功能</p>
              <p className="text-[10px] text-gray-500 mt-1">请输入: <code className="bg-[#181822] px-1 py-0.5 rounded border border-[#2D2D3D] text-gray-400 text-[9px]">json</code>, <code className="bg-[#181822] px-1 py-0.5 rounded border border-[#2D2D3D] text-gray-400 text-[9px]">regex</code>, <code className="bg-[#181822] px-1 py-0.5 rounded border border-[#2D2D3D] text-gray-400 text-[9px]">clean</code> 或 <code className="bg-[#181822] px-1 py-0.5 rounded border border-[#2D2D3D] text-gray-400 text-[9px]">py</code></p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 选项卡导航 */}
          <div className="flex items-center justify-between bg-[#0E0E12] px-4 py-2 border-b border-[#2D2D3A]">
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setActiveTab("widgets")}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === "widgets" ? "bg-[#1C1C24] text-[#0076FF] border border-[#2D2D3A]" : "text-gray-400 hover:text-white hover:bg-[#17171E]/50"}`}
              >
                内置微面板
              </button>
              <button 
                onClick={() => { setActiveTab("database"); refreshIsolatedKeys(); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === "database" ? "bg-[#1C1C24] text-[#0076FF] border border-[#2D2D3A]" : "text-gray-400 hover:text-white hover:bg-[#17171E]/50"}`}
              >
                <Database size={12} />
                <span>沙箱隔离型轻型数据库 Sled ({isolatedDbKeys.length})</span>
              </button>
              <button 
                onClick={() => setActiveTab("plugins")}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === "plugins" ? "bg-[#1C1C24] text-[#0076FF] border border-[#2D2D3A]" : "text-gray-400 hover:text-white hover:bg-[#17171E]/50"}`}
              >
                <Layers size={12} />
                <span>动态可拔插核心 ({plugins.length})</span>
              </button>
            </div>

            {clipboardFeedback && (
              <span className="text-[11px] text-[#10B981] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md animate-pulse font-medium">
                {clipboardFeedback === "Copied to clipboard!" ? "已成功复制到系统剪切板！" : clipboardFeedback}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === "widgets" && (
              <div className="space-y-4">
                {/* 快速命令区域 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Terminal size={12} className="text-amber-500" />
                    <span>控制台快速直达命令</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {plugins.map((plugin) => (
                      <React.Fragment key={plugin.id}>
                        {plugin.features.map(feat => feat.ui && (
                          <button
                            key={feat.code}
                            id={`btn-run-${plugin.id}`}
                            onClick={() => onRunFeature(plugin, feat)}
                            style={{ borderLeft: `4px solid ${feat.ui.color}` }}
                            className="bg-[#17171E] hover:bg-[#1C1C24] border border-[#2D2D3A] text-white p-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="p-1.5 rounded bg-[#17171E] text-white">
                                {renderIcon(feat.ui.icon)}
                              </span>
                              <div>
                                <div className="text-xs font-medium text-gray-200 group-hover:text-white">
                                  {feat.ui.label === "JSON Formatter" ? "JSON 格式化沙箱" : 
                                   feat.ui.label === "Regex Helper" ? "正则辅助验证沙箱" : 
                                   feat.ui.label === "Clipboard Purifier" ? "净化系统剪贴板" : 
                                   feat.ui.label === "Clean Whitespaces" ? "清除冗余空白字符" : feat.ui.label}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{plugin.name}</div>
                              </div>
                            </div>
                            <span className="text-lg opacity-80 group-hover:opacity-100">{plugin.logo}</span>
                          </button>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* 主动监控微挂件 */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {/* 剪切板自动净化监控 */}
                  <div className="bg-[#17171E] border border-[#2D2D3A] rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400">剪贴板全自动净化进程 (Purifier)</span>
                        <span className="text-emerald-400 text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">已启用</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                        智能净化系统剪贴板中多余的空白、特殊制表符、空白断行、并标准化段落分隔。
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#2D2D3A] flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>净化总调用计数:</span>
                      <span className="text-emerald-400 font-bold">{purifyCount} 次运行</span>
                    </div>
                  </div>

                  {/* 动态拼音库 */}
                  <div className="bg-[#17171E] border border-[#2D2D3A] rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-400">拼音/拼音首字母模糊转换客户端</span>
                      <input 
                        type="text" 
                        value={pinyinText}
                        onChange={(e) => setPinyinText(e.target.value)}
                        placeholder="请输入中文汉字进行转换验证..."
                        className="w-full mt-2 bg-[#1C1C24] text-xs border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none focus:border-[#0076FF] transition-all font-sans"
                      />
                      {pinyinText && (
                        <button
                          onClick={() => handlePinyinConversion(pinyinText)}
                          className="mt-2 text-[10px] bg-[#0076FF] hover:bg-blue-600 text-white font-medium px-2.5 py-1 rounded-md cursor-pointer transition-all"
                        >
                          立即提取拼音
                        </button>
                      )}
                    </div>
                    {pinyinOutput && (
                      <div className="mt-2.5 p-2 bg-[#1C1C24] rounded-xl border border-[#2D2D3A] text-[11px] text-blue-400 font-mono break-all leading-relaxed animate-fade-in">
                        {pinyinOutput}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 多沙箱本地隔离存储查看器 */}
            {activeTab === "database" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={13} className="text-[#0076FF]" />
                    <span>插件隔离型轻量级 KV 存储 (多沙箱数据存储保护隔离)</span>
                  </h4>
                  <button 
                    onClick={refreshIsolatedKeys}
                    className="text-[10px] text-[#0076FF] hover:underline"
                  >
                    刷新缓存
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed bg-[#0E0E12] p-3 rounded-xl border border-[#2D2D3A]">
                  <strong>底层隔离数据安全规约：</strong> 为了防止恶意插件窃取或修改其他插件的配置或凭证，当子进程沙箱发起本地 KV 数据库写入时，系统适配引擎会自动在 Key 头部强注入沙箱保护隔离前缀 <code className="bg-[#1C1C24] px-1.5 py-0.5 text-[#0076FF] rounded border border-[#2D2D3A] font-mono font-bold">"plugin_isolated:&#123;pluginId&#125;:"</code>，使得不同插件绝无法跨越命名空间窃取或改写其他应用的数据。
                </p>

                {isolatedDbKeys.length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {isolatedDbKeys.map((item, idx) => (
                      <div key={idx} className="bg-[#17171E] border border-[#2D2D3A] rounded-xl p-3 text-xs flex flex-col justify-between gap-2 hover:border-gray-600 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#0076FF] font-bold bg-[#0076FF]/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {item.pluginId}
                          </span>
                          <button 
                            onClick={() => handleDeleteStorageKey(item.pluginId, item.key)}
                            className="text-gray-500 hover:text-red-400 p-0.5 transition-all"
                            title="删除此键值对"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-6 gap-2 text-[11px] font-mono">
                          <span className="col-span-2 text-gray-400 border-r border-[#2D2D3A] pr-1 overflow-hidden text-ellipsis">
                            键名 (Key): <strong className="text-gray-300">"{item.key}"</strong>
                          </span>
                          <span className="col-span-4 text-emerald-400 overflow-hidden text-ellipsis whitespace-nowrap" title={item.value}>
                            键值 (Value): <span className="text-gray-400">{item.value}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-[#0E0E12] rounded-2xl border border-dashed border-[#2D2D3A]">
                    <span className="text-[20px]">🗄️</span>
                    <p className="text-xs text-gray-400 mt-2">隔离型本地数据库当前暂无数据项。</p>
                    <p className="text-[10px] text-gray-500 mt-1">运行任何内置面板快捷工具、转换拼音或启动 JSON/Regex 沙箱，它将产生隔离数据项。</p>
                  </div>
                )}
              </div>
            )}

            {/* 插件注册管理器 */}
            {activeTab === "plugins" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    动态可插拔插件注册表 (Dynamic Registry)
                  </h4>
                  <button
                    onClick={() => setIsCreatingPlugin(!isCreatingPlugin)}
                    className="bg-[#0076FF] hover:bg-[#0066dd] text-white text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus size={13} />
                    <span>{isCreatingPlugin ? "查看已安装插件" : "动态注册新插件"}</span>
                  </button>
                </div>

                {isCreatingPlugin ? (
                  <form onSubmit={handleCreatePlugin} className="bg-[#17171E] border border-[#2D2D3A] rounded-2xl p-4 space-y-4 shadow-md animate-fade-in">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-400 mb-1 text-[11px]">插件唯一标识符 (ID)</label>
                        <input 
                          type="text" 
                          required 
                          value={newPluginId} 
                          onChange={(e) => setNewPluginId(e.target.value)} 
                          placeholder="如 markdown-preview"
                          className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none focus:border-[#0076FF]"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 text-[11px]">插件显示名称</label>
                        <input 
                          type="text" 
                          required 
                          value={newPluginName} 
                          onChange={(e) => setNewPluginName(e.target.value)} 
                          placeholder="例如: MD 渲染阅读器"
                          className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none focus:border-[#0076FF]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-400 mb-1 text-[11px]">入口形式</label>
                        <select 
                          value={newPluginType} 
                          onChange={(e: any) => setNewPluginType(e.target.value)} 
                          className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none"
                        >
                          <option value="webview">Webview 独立沙箱</option>
                          <option value="panel">Host 原生控制面板</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 text-[11px]">Emoji 图标</label>
                        <input 
                          type="text" 
                          maxLength={2} 
                          value={newPluginLogo} 
                          onChange={(e) => setNewPluginLogo(e.target.value)} 
                          className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 text-[11px]">拼音触发关联词</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="例如: md" 
                          value={newFeatureCmd} 
                          onChange={(e) => setNewFeatureCmd(e.target.value)} 
                          className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none focus:border-[#0076FF]"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-gray-400 mb-1 text-[11px]">快捷键/命令效果说明</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="描述该快捷功能会执行什么动作..." 
                        value={newFeatureExplain} 
                        onChange={(e) => setNewFeatureExplain(e.target.value)} 
                        className="w-full bg-[#1C1C24] border border-[#2D2D3A] rounded-xl p-2 text-gray-200 focus:outline-none focus:border-[#0076FF]"
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-[#0076FF] hover:bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-xl cursor-pointer transition-all shadow-md"
                    >
                      注册并将插件部署至微系统
                    </button>
                  </form>
                ) : (
                  <div className="space-y-2 animate-fade-in">
                    {plugins.map((plugin) => (
                      <div key={plugin.id} className="bg-[#17171E] border border-[#2D2D3A] rounded-xl p-3 text-xs flex items-center justify-between hover:border-gray-600 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-xl bg-[#1C1C24] p-2 rounded-xl border border-[#2D2D3A]">{plugin.logo}</span>
                          <div>
                            <div className="font-semibold text-gray-200">{plugin.name === "JSON Formatter" ? "JSON 格式助手" : plugin.name === "Regex Helper" ? "Regex 正则校验器" : plugin.name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                              <span className="font-mono bg-[#1C1C24] px-1.5 py-0.5 rounded border border-[#2D2D3A] text-blue-400">{plugin.id}</span>
                              <span>•</span>
                              <span className="capitalize">{plugin.entryType === "webview" ? "独立沙箱" : "原生面板"} 入口</span>
                            </div>
                          </div>
                        </div>

                        {/* 限制删除系统级基础插件以维持稳定性 */}
                        {plugin.id.startsWith("my-toolbox-") ? (
                          <span className="text-[10px] text-[#0076FF] bg-[#0076FF]/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            内置组件
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUninstall(plugin.id)}
                            className="bg-[#3a1d1d] hover:bg-red-950/60 text-red-400 border border-red-900/50 p-2 rounded-lg cursor-pointer transition-all"
                            title="卸载此外部插件"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
