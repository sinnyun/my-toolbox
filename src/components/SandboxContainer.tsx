import React, { useEffect, useRef } from "react";
import { isTauri, sysInvoke } from "../services/bridge";
import { hostEventBus } from "../services/eventBus";
import { Plugin, PluginFeature } from "../types/plugin";
import { ArrowLeft, Monitor } from "lucide-react";

interface SandboxContainerProps {
  activePlugin: Plugin;
  activeFeature: PluginFeature | null;
  onExit: () => void;
}

export default function SandboxContainer({ activePlugin, activeFeature, onExit }: SandboxContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isTauri()) {
      // In Tauri: invoke native Rust core to instantiate or mount the sub-webview
      sysInvoke("mount_webview_plugin", {
        pluginId: activePlugin.id,
        relativePath: activePlugin.main
      });
      
      // Listen to native teardown events
      const handleExitEvent = (payload: any) => {
        if (payload && payload.action === "close") {
          onExit();
        }
      };
      
      hostEventBus.subscribe(`exit:${activePlugin.id}`, handleExitEvent);
      
      return () => {
        sysInvoke("destroy_webview_plugin", { pluginId: activePlugin.id });
        hostEventBus.unsubscribe(`exit:${activePlugin.id}`, handleExitEvent);
      };
    } else {
      // In Browser: configure sandbox communication and inject the Preload API wrapper on load
      const iframe = iframeRef.current;
      if (!iframe) return;

      const injectBridge = () => {
        if (iframe.contentWindow) {
          // Preload-style API bridge injection
          (iframe.contentWindow as any).myToolbox = {
            publish: (event: string, payload: any) => {
              hostEventBus.publish(event, payload);
            },
            subscribe: (event: string, cb: any) => {
              hostEventBus.subscribe(event, cb);
            },
            db: {
              put: async (key: string, value: any) => {
                return sysInvoke("plugin_db_put", { pluginId: activePlugin.id, key, value });
              },
              get: async (key: string) => {
                return sysInvoke("plugin_db_get", { pluginId: activePlugin.id, key });
              },
              remove: async (key: string) => {
                return sysInvoke("plugin_db_remove", { pluginId: activePlugin.id, key });
              }
            },
            exit: () => {
              onExit();
            }
          };
          
          // Let the plugin know the myToolbox preload is loaded
          if (typeof (iframe.contentWindow as any).onMyToolboxReady === "function") {
            (iframe.contentWindow as any).onMyToolboxReady();
          }
        }
      };

      iframe.addEventListener("load", injectBridge);
      // Fallback injection in case page loads too fast or readyState is complete
      injectBridge();

      return () => {
        iframe.removeEventListener("load", injectBridge);
      };
    }
  }, [activePlugin, onExit]);

  // Under native Tauri environment, render a neat diagnostic placeholder. 
  // The actual child webview will physically layer exactly on top of this area in the desktop app.
  if (isTauri()) {
    return (
      <div className="flex-1 bg-[#111115] rounded-2xl border border-[#2D2D3A] flex flex-col items-center justify-center p-6 text-center text-gray-400 shadow-lg">
        <Monitor size={48} className="text-[#0076FF] mb-4 animate-bounce" />
        <h3 className="text-base font-semibold text-white">原生 Webview 容器已挂载</h3>
        <p className="text-xs max-w-sm mt-2 leading-relaxed">
          Tauri 原生桌面进程已在下方区域实例化了一个完全隔离的独立系统 Webview 视图，位置位于：
          <code className="block bg-[#1C1C24] p-2.5 mt-2 rounded-xl border border-[#2D2D3A] font-mono text-[10px] text-blue-400">
            {activePlugin.main || "Native Host Hook"}
          </code>
        </p>
        <button
          onClick={onExit}
          className="mt-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer"
        >
          强制关闭沙箱视图
        </button>
      </div>
    );
  }

  // Under browser simulation: load high fidelity simulation pages
  return (
    <div className="flex-1 bg-[#111115] rounded-2xl border border-[#2D2D3A] overflow-hidden flex flex-col shadow-lg">
      {/* Simulation Header */}
      <div className="bg-[#0E0E12] px-4 py-3 flex items-center justify-between border-b border-[#2D2D3A]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{activePlugin.logo}</span>
          <div>
            <span className="text-xs font-semibold text-white">
              {activePlugin.name === "JSON Formatter" ? "JSON 格式化沙箱" : 
               activePlugin.name === "Regex Helper" ? "正则辅助验证沙箱" : activePlugin.name}
            </span>
            <span className="text-[9px] text-gray-500 font-mono ml-2 bg-[#1C1C24] px-1.5 py-0.5 rounded border border-[#2D2D3A] font-bold uppercase tracking-wider">
              sandbox-iframe
            </span>
          </div>
        </div>
        <button 
          onClick={onExit}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 bg-[#1C1C24] hover:bg-[#2D2D3A] px-3 py-1.5 rounded-xl border border-[#2D2D3A] cursor-pointer transition-all"
        >
          <ArrowLeft size={12} />
          <span>退出当前沙箱</span>
        </button>
      </div>

      {/* Simulator iframe viewport */}
      <div className="flex-1 bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={getMockPluginHtml(activePlugin.id, activePlugin.name)}
          sandbox="allow-scripts allow-same-origin allow-modals"
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
}

// Generates specialized, functional interactive mini-apps inside the simulated frame sandbox
function getMockPluginHtml(pluginId: string, pluginName: string): string {
  // 1. JSON FORMATTER STANDALONE PLUGIN
  if (pluginId === "my-toolbox-json-format") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 16px;
            background: #0f0f13;
            color: #f3f4f6;
            margin: 0;
            height: calc(100vh - 32px);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }
          .title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }
          .title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #3b82f6;
          }
          .tag {
            font-size: 10px;
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
          }
          .work-area {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            min-height: 0;
          }
          .editor-pane {
            display: flex;
            flex-direction: column;
          }
          .pane-label {
            font-size: 11px;
            color: #9ca3af;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          textarea, .output-viewer {
            flex: 1;
            background: #171720;
            border: 1px solid #2d2d3d;
            border-radius: 6px;
            color: #e5e7eb;
            padding: 10px;
            font-family: "Fira Code", monospace;
            font-size: 11px;
            resize: none;
            box-sizing: border-box;
            outline: none;
            overflow-y: auto;
          }
          textarea:focus {
            border-color: #3b82f6;
          }
          .output-viewer {
            white-space: pre;
          }
          .btn-bar {
            display: flex;
            gap: 8px;
            margin-top: 10px;
          }
          button {
            background: #3b82f6;
            color: #ffffff;
            border: none;
            padding: 7px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: opacity 0.15s;
          }
          button:hover {
            opacity: 0.9;
          }
          .btn-green { background: #10b981; }
          .btn-purple { background: #8b5cf6; }
          .btn-gray { background: #374151; color: #d1d5db; }
          .btn-red { background: #ef4444; }
          .status-msg {
            font-size: 11px;
            margin-top: 5px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="title-row">
          <h3 class="title">JSON 格式化独立沙箱</h3>
          <span class="tag">安全命名空间数据库隔离区</span>
        </div>

        <div class="work-area">
          <div class="editor-pane">
            <span class="pane-label">原始未排版 JSON 字符串</span>
            <textarea id="rawJson" placeholder="在此粘贴杂乱或未格式化的 JSON 数据..."></textarea>
          </div>
          <div class="editor-pane">
            <span class="pane-label">排版渲染视图</span>
            <div id="prettyOutput" class="output-viewer">{}</div>
          </div>
        </div>

        <div class="btn-bar">
          <button id="btnFormat">精美排版 (2空格缩进)</button>
          <button id="btnMinify" class="btn-gray">压缩为单行</button>
          <button id="btnSave" class="btn-green">安全沙箱保存</button>
          <button id="btnBroadcast" class="btn-purple">同步到剪贴板</button>
          <button id="btnExit" class="btn-red">退出</button>
        </div>

        <div id="status" class="status-msg">预加载安全隔离桥已激活。沙箱专属数据库加载完毕。</div>

        <script>
          const rawInput = document.getElementById('rawJson');
          const prettyView = document.getElementById('prettyOutput');
          const statusText = document.getElementById('status');

          // Async function waiting for myToolbox API bridge load
          window.onMyToolboxReady = async () => {
            statusText.innerText = "My Toolbox 适配就绪。正在检索最近一次编辑的 JSON 状态...";
            // Read state isolated in sandbox
            const lastSaved = await window.myToolbox.db.get('last_formatted');
            if (lastSaved) {
              rawInput.value = lastSaved;
              runFormat();
              statusText.innerText = "已成功从隔离存储中恢复上一次的 JSON 编辑状态。";
            } else {
              rawInput.value = '{"project":"my-toolbox","features":["isolation","pluggable","adaptive"],"stats":{"stars":1024,"forks":256}}';
              runFormat();
            }
          };

          const runFormat = () => {
            try {
              const text = rawInput.value.trim();
              if(!text) {
                prettyView.innerText = "";
                return;
              }
              const obj = JSON.parse(text);
              prettyView.innerText = JSON.stringify(obj, null, 2);
              statusText.innerText = "JSON 格式校验通过。";
              prettyView.style.color = "#a7f3d0";
            } catch (err) {
              prettyView.innerText = err.message;
              prettyView.style.color = "#fca5a5";
              statusText.innerText = "语法解析异常: " + err.message;
            }
          };

          rawInput.oninput = runFormat;

          document.getElementById('btnFormat').onclick = runFormat;

          document.getElementById('btnMinify').onclick = () => {
            try {
              const text = rawInput.value.trim();
              if(!text) return;
              const obj = JSON.parse(text);
              const min = JSON.stringify(obj);
              prettyView.innerText = min;
              prettyView.style.color = "#e5e7eb";
              statusText.innerText = "JSON 单行压缩完毕。";
            } catch (err) {
              prettyView.innerText = err.message;
              prettyView.style.color = "#fca5a5";
            }
          };

          // Hard Isolation Storage Trigger
          document.getElementById('btnSave').onclick = async () => {
            const val = rawInput.value;
            // The myToolbox wrapper prefixes 'plugin_isolated:my-toolbox-json-format:last_formatted' under the hood!
            await window.myToolbox.db.put('last_formatted', val);
            statusText.innerText = "✓ 成功在沙箱内隔离保存键 'last_formatted'。请查看‘沙箱隔离型轻型数据库 Sled’面板！";
          };

          // Event bus publishing
          document.getElementById('btnBroadcast').onclick = () => {
            const val = prettyView.innerText;
            window.myToolbox.publish('clipboard_update', { text: val });
            statusText.innerText = "🔊 已成功将美化后的 JSON 字符串通过事件总线广播并同步至系统剪贴板。";
          };

          document.getElementById('btnExit').onclick = () => {
            window.myToolbox.exit();
          };
        </script>
      </body>
      </html>
    `;
  }

  // 2. REGEX HELPER STANDALONE PLUGIN
  if (pluginId === "my-toolbox-regex-helper") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 16px;
            background: #0d0e12;
            color: #e2e8f0;
            margin: 0;
            height: calc(100vh - 32px);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }
          .title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #f59e0b;
          }
          .sandbox-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
          }
          .input-row {
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 8px;
          }
          .field-group {
            display: flex;
            flex-direction: column;
          }
          .field-group label {
            font-size: 10px;
            color: #94a3b8;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          input, textarea {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 4px;
            color: #f8fafc;
            padding: 8px;
            font-family: monospace;
            font-size: 11px;
            outline: none;
            box-sizing: border-box;
          }
          input:focus, textarea:focus {
            border-color: #f59e0b;
          }
          .presets-wrapper {
            background: #111827;
            padding: 8px;
            border-radius: 6px;
            border: 1px solid #1f2937;
          }
          .presets-title {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .preset-btns {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
          }
          .preset-btn {
            background: #1e293b;
            color: #94a3b8;
            border: 1px solid #334155;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            cursor: pointer;
          }
          .preset-btn:hover {
            color: #f8fafc;
            border-color: #f59e0b;
          }
          .results-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .match-box {
            flex: 1;
            background: #0b0f17;
            border: 1px solid #1e293b;
            border-radius: 6px;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            overflow-y: auto;
            white-space: pre-wrap;
            box-sizing: border-box;
          }
          .highlight {
            background-color: rgba(245, 158, 11, 0.3);
            border-bottom: 2px solid #f59e0b;
            color: #fef08a;
            border-radius: 2px;
            padding: 1px 0;
          }
          .btn-row {
            display: flex;
            gap: 8px;
            margin-top: 10px;
          }
          button {
            background: #f59e0b;
            color: #1e293b;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
          }
          button:hover {
            opacity: 0.9;
          }
          .btn-blue { background: #3b82f6; color: #fff; }
          .btn-red { background: #ef4444; color: #fff; }
          .status {
            font-size: 10px;
            color: #64748b;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h3 class="title">正则表达式辅助验证套件</h3>
          <span class="status" id="readyStatus">沙箱隔离环境初始化中...</span>
        </div>

        <div class="sandbox-main">
          <div class="input-row">
            <div class="field-group">
              <label>正则表达式规则 (Pattern)</label>
              <input type="text" id="regexInput" value="\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b" placeholder="在此输入正则表达式...">
            </div>
            <div class="field-group">
              <label>匹配修饰符 (Flags)</label>
              <input type="text" id="flagsInput" value="g" placeholder="例如: g, i, m">
            </div>
          </div>

          <div class="presets-wrapper">
            <div class="presets-title">常用推荐正则规则</div>
            <div class="preset-btns">
              <button type="button" class="preset-btn" data-reg="\\\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Z|a-z]{2,}\\\\b" data-flag="g">电子邮箱 (Email)</button>
              <button type="button" class="preset-btn" data-reg="^(http|https)://[^\\\\s/$.?#].[^\\\\s]*$" data-flag="g">互联网链接 (URL)</button>
              <button type="button" class="preset-btn" data-reg="\\\\b(19|20)\\\\d\\\\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])\\\\b" data-flag="g">日期格式 (YYYY-MM-DD)</button>
              <button type="button" class="preset-btn" data-reg="^[0-9]+$" data-flag="g">纯数字串</button>
            </div>
          </div>

          <div class="field-group results-pane">
            <label>待匹配测试源文本</label>
            <textarea id="textSubject" style="height: 60px; margin-bottom: 6px;" placeholder="在此输入需要验证或提取的原始文本内容...">欢迎联系我们！支持邮箱 support@my-toolbox.app，商务合作 sales-team@my-toolbox.org，期待与您的交流！</textarea>
            <label>高亮捕获匹配结果</label>
            <div id="matchOutput" class="match-box"></div>
          </div>
        </div>

        <div class="btn-row">
          <button id="btnSave" class="btn-blue">保存规则到沙箱</button>
          <button id="btnPush">广播当前正则到剪贴板</button>
          <button id="btnExit" class="btn-red">退出沙箱</button>
        </div>

        <script>
          const regexIn = document.getElementById('regexInput');
          const flagsIn = document.getElementById('flagsInput');
          const subjectIn = document.getElementById('textSubject');
          const outputBox = document.getElementById('matchOutput');
          const statusLbl = document.getElementById('readyStatus');

          window.onMyToolboxReady = async () => {
            statusLbl.innerText = "PRELOAD ACTIVE | 正在连接独立 Sled 数据库...";
            const savedPattern = await window.myToolbox.db.get('custom_pattern');
            const savedFlags = await window.myToolbox.db.get('custom_flags');
            if (savedPattern) {
              regexIn.value = savedPattern;
              flagsIn.value = savedFlags || "g";
            }
            runTest();
            statusLbl.innerText = "沙箱参数加载完毕。数据库强防篡改保护生效。";
          };

          const runTest = () => {
            try {
              const pattern = regexIn.value;
              const flags = flagsIn.value;
              const subject = subjectIn.value;

              if (!pattern || !subject) {
                outputBox.innerText = subject;
                return;
              }

              const re = new RegExp(pattern, flags);
              
              if (!flags.includes('g')) {
                // Single match
                const match = subject.match(re);
                if (match) {
                  const matchedText = match[0];
                  const idx = match.index;
                  const before = subject.slice(0, idx);
                  const after = subject.slice(idx + matchedText.length);
                  outputBox.innerHTML = escapeHtml(before) + '<span class="highlight">' + escapeHtml(matchedText) + '</span>' + escapeHtml(after);
                } else {
                  outputBox.innerText = subject;
                }
              } else {
                // Global matches
                let formatted = "";
                let lastIdx = 0;
                let match;
                
                // Reset regex last index
                re.lastIndex = 0;
                
                // Safeguard against infinite loops with empty matches
                let preventInfinite = 0;

                while ((match = re.exec(subject)) !== null) {
                  if (match.index === re.lastIndex) {
                    re.lastIndex++; // force advance
                  }
                  
                  const beforeMatch = subject.slice(lastIdx, match.index);
                  formatted += escapeHtml(beforeMatch) + '<span class="highlight">' + escapeHtml(match[0]) + '</span>';
                  lastIdx = re.lastIndex || (match.index + match[0].length);

                  if (++preventInfinite > 500) break;
                }
                
                formatted += escapeHtml(subject.slice(lastIdx));
                outputBox.innerHTML = formatted;
              }
            } catch (err) {
              outputBox.innerHTML = '<span style="color:#ef4444">' + escapeHtml(err.message) + '</span>';
            }
          };

          function escapeHtml(str) {
            return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          }

          regexIn.oninput = runTest;
          flagsIn.oninput = runTest;
          subjectIn.oninput = runTest;

          // Wire preset buttons
          document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.onclick = () => {
              regexIn.value = btn.getAttribute('data-reg');
              flagsIn.value = btn.getAttribute('data-flag');
              runTest();
            };
          });

          // Save isolated configuration
          document.getElementById('btnSave').onclick = async () => {
            await window.myToolbox.db.put('custom_pattern', regexIn.value);
            await window.myToolbox.db.put('custom_flags', flagsIn.value);
            statusLbl.innerText = "✓ 配置已成功隔离存储至 Sled 隔离空间！";
          };

          // Broadcast Regex
          document.getElementById('btnPush').onclick = () => {
            window.myToolbox.publish('clipboard_update', { text: regexIn.value });
            statusLbl.innerText = "🔊 已成功将正则表达式通过事件总线复制并同步至宿主剪贴板。";
          };

          document.getElementById('btnExit').onclick = () => {
            window.myToolbox.exit();
          };
        </script>
      </body>
      </html>
    `;
  }

  // 3. FALLBACK CUSTOM DEV SANDBOX
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: sans-serif;
          background: #111115;
          color: #fff;
          padding: 24px;
          margin: 0;
          text-align: center;
        }
        .icon { font-size: 40px; margin-bottom: 10px; }
        .btn {
          background: #ec4899;
          border: none;
          color: #fff;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="icon">🔌</div>
      <h3>动态可插拔沙箱应用</h3>
      <p style="font-size:12px; color:#888;">
        插件 ID: <strong style="color:#ec4899">${pluginId}</strong>
      </p>
      <p style="font-size:12px; max-width:300px; margin: 10px auto; color:#aaa;">
        该插件已在完全隔离的子进程容器中动态载入，并通过 Preload Bridge 安全访问桌面级原生 API。
      </p>
      <button class="btn" onclick="window.myToolbox.exit()">关闭并退出插件</button>
    </body>
    </html>
  `;
}
