# Architecture

## 痛点分析

AI 辅助桌面客户端 UI 开发的核心困难：

```
┌─────────────┐     写代码      ┌─────────────┐     编译运行     ┌──────────┐
│  AI Agent   │ ──────────────→ │  源代码      │ ──────────────→ │  渲染结果  │
│ (Claude 等)  │    XAML/Swing   │  (.cs/.java) │                │  (屏幕)    │
└─────────────┘                 └─────────────┘                 └──────────┘
      ↑                                                                  │
      │                    ← AI 看不到这一步 ←───────────────────────────┘
      └── 用户人工反馈（低效、容易遗漏）
```

ClientDebugMCP 打通这个反馈闭环：

```
┌─────────────┐     写代码      ┌─────────────┐     编译运行     ┌──────────┐
│  AI Agent   │ ──────────────→ │  源代码      │ ──────────────→ │  渲染结果  │
└──────┬──────┘                 └─────────────┘                 └─────┬────┘
       │                                                              │
       └── MCP 截屏 + 控件树 + 像素分析 ←────────────────────────────┘
           AI 自己看到渲染结果，自己修正
```

## 技术选型

| 层 | 技术 | 理由 |
|---|---|---|
| MCP Server | TypeScript + @modelcontextprotocol/sdk | 标准协议，生态成熟 |
| UI 检查 | Windows UI Automation (COM) | Windows 系统内置，支持 WPF/WinForms/Win32 |
| 截图 | node-screenshots + PowerShell | 双通道确保可靠 |
| 像素分析 | jimp + 自定义算法 | 白底检测、对比度计算、色域分析 |
| 窗口管理 | get-windows | 跨进程窗口查找和定位 |

## 数据流

```
MCP Client (Claude/Codex)
    │ JSON-RPC over stdio
    ▼
ClientDebugMCP Server
    │
    ├── ui_inspect ──→ PowerShell UI Automation ──→ 控件树 JSON
    ├── pixel_analyze ──→ System.Drawing 截屏 ──→ 像素统计 JSON
    ├── screenshot ──→ node-screenshots ──→ JPEG base64
    ├── ui_invoke ──→ InvokePattern ──→ { success: true }
    └── ui_set_text ──→ ValuePattern ──→ { success: true }
```
