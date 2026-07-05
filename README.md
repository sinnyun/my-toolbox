# My Toolbox

高保真桌面工具箱平台，受 uTools 启发，支持多沙箱隔离运行、动态插件热插拔、浏览器/桌面双核适配。

## 技术栈

- **前端:** React 19 + TypeScript + Tailwind CSS v4
- **构建:** Vite 8
- **桌面:** Tauri v2 (Rust)
- **运行模式:** 浏览器 Mock IPC / Tauri 原生桌面，同一套代码零切换

## 项目结构

```
src/
├── App.tsx                 # 页面路由中心 (home/settings/debug)
├── pages/
│   ├── HomePage.tsx        # 主页: 搜索栏 + 插件卡片 + 沙箱容器
│   ├── SettingsPage.tsx    # 设置: 左侧导航 + 右侧内容
│   └── DebugPage.tsx       # 调试: IPC 日志表格 + 统计面板
├── components/
│   ├── BottomNav.tsx       # 底部三按钮导航栏
│   ├── SandboxContainer.tsx # iframe 沙箱容器 + Preload Bridge 注入
│   └── Dashboard.tsx       # 内置微面板组件
├── services/
│   ├── bridge.ts           # 适配层: Tauri 原生调用 / Mock 降级
│   └── eventBus.ts         # 跨框架事件总线
├── mocks/
│   └── tauriMock.ts        # Mock 数据库、插件注册、IPC 遥测
└── types/
    └── plugin.ts           # 插件类型定义
```

## 快速开始

**前置要求:** Node.js 18+, Rust toolchain (桌面构建)

```bash
# 安装依赖
npm install

# 浏览器开发模式
npm run dev

# Tauri 桌面开发模式
npm run tauri dev
```

## 架构设计

### 双核适配模式

`bridge.ts` 作为中间层，自动检测运行环境：

- **浏览器环境:** 调用 `tauriMock.ts` 提供内存级 Mock 服务
- **Tauri 环境:** 动态导入 `@tauri-apps/api/core` 执行原生 Rust 调用

前端组件无需任何条件判断，同一套代码在两种环境下无缝运行。

### 沙箱隔离

插件在独立 iframe/WebView 中运行，通过 `window.myToolbox` Bridge API 与宿主通信：

```javascript
// 插件内可调用的 API
window.myToolbox.db.put(key, value)     // 隔离命名空间存储
window.myToolbox.db.get(key)
window.myToolbox.publish(event, payload) // 事件总线广播
window.myToolbox.exit()                  // 退出插件
```

每个插件的存储 Key 自动添加 `plugin_isolated:{pluginId}:` 前缀，确保命名空间完全隔离。

## 开源协议

MIT
