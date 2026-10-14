# 开发痛点记录

本文档记录 NMG 项目客户端 UI 开发过程中遇到的实际问题，
作为 ClientDebugMCP 需要解决的需求来源。

## 1. 白色背景在深色主题中刺眼

**现象**：WPF ComboBox、TextBox、Button 默认模板渲染为白色背景，
即使设置了 `Background="Black"` 也只改变外层，内层仍然是白色。

**原因**：WPF 控件内部有 ControlTemplate，硬编码了浅色视觉结构。
简单设置属性无法覆盖模板内部的 Border 和 ContentPresenter。

**修复方式**：需要写完整的 ControlTemplate 覆盖，或使用 UI 库（WPF-UI / HandyControl）。

**ClientDebugMCP 解决方案**：`pixel_analyze` 工具自动检测窗口中的白色像素占比，
AI 可以在写完 XAML 后立即检查是否有白色背景残留。

## 2. 控件高度/宽度不一致

**现象**：ComboBox 高度 68px，TextBox 高度 70px，Button 高度 79px，
放在同一行的控件高低不齐。

**原因**：WPF 不同控件的默认高度不同，Padding 计算方式也不同。

**修复方式**：手动设置 `Height="42"` 到每个控件。

**ClientDebugMCP 解决方案**：`ui_inspect` 工具返回每个控件的精确宽高，
AI 可以对比发现不一致并自动修正。

## 3. 文字颜色对比度不足

**现象**：深色背景上使用 #9E9E9E 的标签文字，用户反馈"看不清"。

**原因**：AI 无法计算实际渲染的对比度，只是按经验选择颜色。

**修复方式**：用户反馈后手动调整为 #FFFFFF。

**ClientDebugMCP 解决方案**：`pixel_analyze` 可以采样特定区域的颜色，
配合 WCAG 对比度计算公式，AI 可以自动验证是否满足 4.5:1 最低标准。

## 4. 中文文字偏移

**现象**：TextBox 内的中文字符垂直方向偏移，不在正中间。

**原因**：WPF TextBox 的 Padding 和 VerticalContentAlignment 与中文字体的
行高计算方式不一致。

**修复方式**：多次调整 Padding 和 VerticalAlignment。

**ClientDebugMCP 解决方案**：`ui_get_element` 返回控件的精确位置和大小，
结合截图可以判断文字是否居中。

## 5. NMG 标题和语言按钮重叠

**现象**：放在 ui:TitleBar.Header 里的 NMG 文字和 EN 按钮重叠。

**原因**：WPF-UI 库的 TitleBar.Header 区域和窗口控制按钮（最小化/最大化/关闭）
共享空间，自定义 Header 内容会被挤到按钮下方。

**修复方式**：将 EN 按钮从 TitleBar.Header 移到主内容区域。

**ClientDebugMCP 解决方案**：`ui_inspect` 返回元素坐标，
AI 可以检测两个元素的 BoundingRectangle 是否重叠。
