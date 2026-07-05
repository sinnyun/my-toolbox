import React from "react";
import { Home, Settings, Terminal } from "lucide-react";
import { PageId } from "../App";

interface BottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "主页", icon: <Home size={18} /> },
  { id: "settings", label: "设置", icon: <Settings size={18} /> },
  { id: "debug", label: "调试", icon: <Terminal size={18} /> },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className="w-full max-w-4xl mx-auto z-20 pb-4 px-6">
      <div className="bg-[#121218]/95 backdrop-blur-xl border border-[#2D2D3D] rounded-2xl shadow-lg px-2 py-2 flex items-center justify-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              currentPage === item.id
                ? "bg-[#0076FF]/10 text-[#0076FF] border border-[#0076FF]/20 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-[#1C1C24] border border-transparent"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
