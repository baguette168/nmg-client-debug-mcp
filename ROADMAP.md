# Roadmap

## Phase 1 — MVP（当前）
- [x] 基于 @cool-mcp/desktop-automation 改造
- [x] ui_inspect: WPF 控件树遍历
- [x] ui_get_element: 按 AutomationId 查询
- [x] ui_set_text: 设置文本
- [x] ui_invoke: 点击按钮
- [x] pixel_analyze: 白底检测 + 像素统计
- [x] 基础文档

## Phase 2 — 增强调试能力
- [ ] 截图工具（整窗口 + 区域截图）
- [ ] WCAG 对比度自动检查
- [ ] 控件重叠检测（BoundingRectangle 相交测试）
- [ ] 多显示器支持
- [ ] DPI 缩放感知

## Phase 3 — 多框架支持
- [ ] Java Swing (Java Access Bridge)
- [ ] Electron (Chrome DevTools Protocol)
- [ ] Win32 原生 (User32 API)

## Phase 4 — 高级功能
- [ ] 视觉回归测试（前后截图对比）
- [ ] 布局验证规则引擎（间距/对齐/一致性检查）
- [ ] 自动化修复建议（AI 分析截图后建议 CSS/XAML 修改）
