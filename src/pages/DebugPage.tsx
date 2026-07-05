import React, { useState, useMemo } from "react";
import { IpcLog } from "../services/ipcLogger";
import { Terminal, Filter, RefreshCw, CheckCircle, XCircle, Trash2 } from "lucide-react";

interface DebugPageProps {
  ipcLogs: IpcLog[];
}

type LogFilter = "all" | "success" | "error";

export default function DebugPage({ ipcLogs }: DebugPageProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    if (filter === "all") return ipcLogs;
    return ipcLogs.filter((l) => l.status === filter);
  }, [ipcLogs, filter]);

  const stats = useMemo(() => ({
    total: ipcLogs.length,
    success: ipcLogs.filter((l) => l.status === "success").length,
    error: ipcLogs.filter((l) => l.status === "error").length,
    commands: [...new Set(ipcLogs.map((l) => l.command))].length,
  }), [ipcLogs]);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "总调用", value: stats.total, color: "text-white" },
          { label: "成功", value: stats.success, color: "text-emerald-400" },
          { label: "失败", value: stats.error, color: "text-red-400" },
          { label: "指令类型", value: stats.commands, color: "text-[#0076FF]" },
        ].map((s) => (
          <div key={s.label} className="bg-[#121218]/95 backdrop-blur-xl rounded-xl border border-[#2D2D3D] p-3 text-center">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="bg-[#121218]/95 backdrop-blur-xl rounded-xl border border-[#2D2D3D] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#0076FF]" />
          <span className="text-xs font-semibold text-gray-300">IPC 调用日志</span>
          <span className="text-[10px] text-gray-500 font-mono">({filteredLogs.length} 条)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "success", "error"] as LogFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                filter === f
                  ? f === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : f === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-[#0076FF]/10 text-[#0076FF] border border-[#0076FF]/20"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {f === "all" ? "全部" : f === "success" ? "成功" : "失败"}
            </button>
          ))}
        </div>
      </div>

      {/* 日志表格 */}
      <div className="flex-1 bg-[#121218]/95 backdrop-blur-xl rounded-2xl border border-[#2D2D3D] overflow-hidden flex flex-col min-h-0">
        {filteredLogs.length > 0 ? (
          <>
            {/* 表头 */}
            <div className="grid grid-cols-[100px_1fr_1fr_1fr_80px] gap-3 px-4 py-2.5 bg-[#0E0E12] border-b border-[#2D2D3D] text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              <span>时间</span>
              <span>指令</span>
              <span>参数</span>
              <span>返回值</span>
              <span className="text-right">状态</span>
            </div>
            {/* 表体 */}
            <div className="flex-1 overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border-b border-[#2D2D3D]/50 last:border-b-0">
                  <div
                    className="grid grid-cols-[100px_1fr_1fr_1fr_80px] gap-3 px-4 py-2.5 text-xs font-mono hover:bg-[#181822] transition-colors cursor-pointer items-center"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <span className="text-gray-500">{log.timestamp}</span>
                    <span className="text-[#0076FF] font-bold truncate">{log.command}</span>
                    <span className="text-gray-400 truncate" title={JSON.stringify(log.args)}>{JSON.stringify(log.args)}</span>
                    <span className="text-emerald-400 truncate" title={JSON.stringify(log.response)}>{JSON.stringify(log.response)}</span>
                    <span className="text-right">
                      {log.status === "success" ? (
                        <CheckCircle size={14} className="inline text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="inline text-red-400" />
                      )}
                    </span>
                  </div>
                  {expandedId === log.id && (
                    <div className="px-4 pb-3 animate-fade-in">
                      <div className="bg-[#0F0F15] rounded-xl border border-[#2D2D3D] p-3 text-[11px] font-mono space-y-2">
                        <div><span className="text-gray-500">指令:</span> <span className="text-[#0076FF]">{log.command}</span></div>
                        <div><span className="text-gray-500">参数:</span> <span className="text-gray-300 break-all">{JSON.stringify(log.args, null, 2)}</span></div>
                        <div><span className="text-gray-500">返回:</span> <span className="text-emerald-400 break-all">{JSON.stringify(log.response, null, 2)}</span></div>
                        <div><span className="text-gray-500">状态:</span> <span className={log.status === "success" ? "text-emerald-400" : "text-red-400"}>{log.status}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Terminal size={36} className="mb-3 opacity-40" />
            <p className="text-sm">暂无 IPC 调用记录</p>
            <p className="text-xs text-gray-600 mt-1">使用插件后，底层通信日志将在此显示</p>
          </div>
        )}
      </div>
    </div>
  );
}
