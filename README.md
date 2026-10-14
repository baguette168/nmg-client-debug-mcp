# ClientDebugMCP

> 通用桌面客户端 UI 调试 MCP Server — 支持 WPF / WinForms / Java Swing / AWT / Electron

## 痛点

AI 编程助手（Claude / Codex / Copilot）在开发桌面客户端 UI 时面临一个核心问题：

**盲写 UI 代码**。Web 前端有 chrome-devtools-mcp 可以截屏、检查元素、调试网络，
但桌面客户端没有任何等价工具。AI 写了 XAML / Swing 代码却看不到渲染结果，
导致反复出现：

- 白色背景在深色主题中刺眼
- 控件对不齐、高度不一致
- 文字颜色和背景对比度不足
- 中文字体偏移
- 布局在 DPI 缩放时错位

每次修改都需要用户人工确认，效率极低。

## 解决方案

ClientDebugMCP 让 AI 编程助手获得 **桌面客户端的视觉调试能力**：

| 工具 | 功能 | 类比 chrome-devtools-mcp |
|------|------|--------------------------|
| `ui_inspect` | 遍历控件树，返回所有元素属性 | Elements 面板 |
| `ui_get_element` | 按 AutomationId 查询单个控件 | DOM 查询 |
| `ui_set_text` | 向输入框写入文本 | 输入模拟 |
| `ui_invoke` | 触发按钮/菜单点击 | 事件模拟 |
| `pixel_analyze` | 截屏并分析像素颜色分布 | Rendering 面板 |
| `screenshot` | 截取整个窗口或全屏 | Screenshots |

## 支持的客户端框架

| 框架 | UI 检查 | 截图 | 自动化 | 依赖 |
|------|---------|------|--------|------|
| WPF | ✅ UI Automation | ✅ | ✅ | .NET 4+ |
| WinForms | ✅ UI Automation | ✅ | ✅ | .NET 4+ |
| Java Swing/AWT | ✅ Java Access Bridge | ✅ | ⚠️ 有限 | JAB |
| Electron | ✅ CDP | ✅ | ✅ | Chromium CDP |
| Win32 原生 | ⚠️ Win32 API | ✅ | ✅ | User32 |

## 安装

```bash
npm install -g clientdebug-mcp
```

## 配置

在 MCP 客户端（Claude Desktop / Codex）中添加：

```json
{
  "mcpServers": {
    "client-debug": {
      "command": "npx",
      "args": ["-y", "clientdebug-mcp"]
    }
  }
}
```

## 使用示例

```
用户：帮我检查这个 WPF 窗口的布局是否正常

AI（调用 ui_inspect）：
  发现 32 个控件，其中：
  - ComboBox "CmbType" (814×68) 
  - TextBox "TxtPass" (814×70)
  - Button "BtnGenerate" (276×79)
  
用户：看看有没有白色背景

AI（调用 pixel_analyze）：
  扫描 15,515 个像素，发现 8,199 个白色像素 (5.4%)
  主要集中在按钮区域 (y:310-370)
  建议：将 BtnPrimaryBg 从 #FFFFFF 改为 #2D2D2D
```

## 架构

基于 [@cool-mcp/desktop-automation](https://github.com/cool-mcp/desktop-automation) 改造。

```
ClientDebugMCP/
├── src/
│   ├── index.ts          # MCP Server 入口
│   ├── tools/            # 工具实现
│   │   ├── ui-inspect.ts # UI Automation 控件树遍历
│   │   ├── pixel.ts      # 截屏 + 像素分析
│   │   └── interact.ts   # 自动化交互（点击/输入）
│   └── providers/        # 框架适配器
│       ├── wpf.ts        # WPF 专用（DependencyProperty 读取）
│       ├── swing.ts      # Java Swing（JAB 桥接）
│       └── electron.ts   # Electron（CDP）
├── package.json
└── tsconfig.json
```

## License

MIT
