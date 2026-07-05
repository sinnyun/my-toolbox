import React from "react";
import { Home, Settings, Terminal } from "lucide-react";
import { PageId } from "../App";

interface TopNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "主页", icon: <Home size={14} /> },
  { id: "settings", label: "设置", icon: <Settings size={14} /> },
  { id: "debug", label: "调试", icon: <Terminal size={14} /> },
];

export default function TopNav({ currentPage, onNavigate }: TopNavProps) {
  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
            currentPage === item.id
              ? "bg-[#0076FF]/15 text-[#0076FF]"
              : "text-gray-500 hover:text-gray-300 hover:bg-[#1C1C24]"
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
