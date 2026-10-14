#!/usr/bin/env node
/**
 * Desktop Automation MCP Server
 * 提供桌面自动化功能：鼠标、键盘、截图、窗口管理
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// 导入模块
import * as inputController from './input-controller.js';
import * as screenshot from './screenshot.js';
import * as windowManager from './window-manager.js';
import * as wpfInspect from './wpf-inspect.js';
import { bboxToScreenCoords, parseBBox } from './utils.js';
import { SCREENSHOT_CONFIG } from './config.js';
import { getInstalledApps } from 'get-installed-apps';
import open, { openApp } from 'open';
// 创建 MCP 服务器
const server = new Server({
    name: 'desktop-automation-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// 定义工具列表
const TOOLS = [
    {
        name: 'bot_screenshot',
        description: '截取指定进程窗口的截图。返回 JPEG 图片和窗口边界信息（windowBounds 用于后续点击操作）。',
        inputSchema: {
            type: 'object',
            properties: {
                processName: {
                    type: 'string',
                    description: '进程名称（如 "Chrome", "Safari", "Feishu"），建议先调用 bot_list_windows 获取'
                },
                quality: {
                    type: 'number',
                    description: `JPEG 压缩质量 (1-100)，默认 ${SCREENSHOT_CONFIG.quality}。较低值文件更小但可能影响识别精度`,
                    default: SCREENSHOT_CONFIG.quality
                },
                maxWidth: {
                    type: 'number',
                    description: `最大宽度（像素），超过会等比缩放。默认 ${SCREENSHOT_CONFIG.maxWidth}`,
                    default: SCREENSHOT_CONFIG.maxWidth
                }
            },
            required: ['processName']
        }
    },
    {
        name: 'bot_screenshot_fullscreen',
        description: '截取整个屏幕。可指定显示器 ID。',
        inputSchema: {
            type: 'object',
            properties: {
                displayId: {
                    type: 'number',
                    description: '显示器 ID（可选，默认主显示器）'
                }
            }
        }
    },
    {
        name: 'bot_click',
        description: '在指定位置点击鼠标。支持 bbox 坐标（0-1000 归一化）或像素坐标。',
        inputSchema: {
            type: 'object',
            properties: {
                bbox: {
                    type: 'string',
                    description: 'bbox 坐标，格式: "x1 y1 x2 y2" 或 "[x1, y1, x2, y2]"（0-1000 归一化坐标）'
                },
                x: {
                    type: 'number',
                    description: '像素 X 坐标（与 bbox 二选一）'
                },
                y: {
                    type: 'number',
                    description: '像素 Y 坐标（与 bbox 二选一）'
                },
                windowBounds: {
                    type: 'object',
                    description: '窗口边界信息（使用 bbox 时必需，从 bot_screenshot 返回值获取）',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                    }
                },
                button: {
                    type: 'string',
                    enum: ['left', 'right', 'middle'],
                    description: '鼠标按钮（默认 left）'
                },
                clickCount: {
                    type: 'number',
                    minimum: 1,
                    maximum: 2,
                    description: '点击次数（1=单击，2=双击），默认 1'
                }
            }
        }
    },
    {
        name: 'bot_move_mouse',
        description: '移动鼠标到指定位置。',
        inputSchema: {
            type: 'object',
            properties: {
                x: { type: 'number', description: '像素 X 坐标' },
                y: { type: 'number', description: '像素 Y 坐标' },
                bbox: {
                    type: 'string',
                    description: 'bbox 坐标（与 x,y 二选一）'
                },
                windowBounds: {
                    type: 'object',
                    description: '窗口边界信息（使用 bbox 时必需）',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                    }
                }
            }
        }
    },
    {
        name: 'bot_drag',
        description: '鼠标拖拽操作。',
        inputSchema: {
            type: 'object',
            properties: {
                startBbox: {
                    type: 'string',
                    description: '起始 bbox 坐标'
                },
                endBbox: {
                    type: 'string',
                    description: '结束 bbox 坐标'
                },
                startX: { type: 'number', description: '起始像素 X' },
                startY: { type: 'number', description: '起始像素 Y' },
                endX: { type: 'number', description: '结束像素 X' },
                endY: { type: 'number', description: '结束像素 Y' },
                windowBounds: {
                    type: 'object',
                    description: '窗口边界信息（使用 bbox 时必需）',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                    }
                }
            }
        }
    },
    {
        name: 'bot_scroll',
        description: '在当前鼠标位置滚动鼠标滚轮（不会移动鼠标）。',
        inputSchema: {
            type: 'object',
            properties: {
                direction: {
                    type: 'string',
                    enum: ['up', 'down', 'left', 'right'],
                    description: '滚动方向'
                },
                amount: {
                    type: 'number',
                    description: '滚动量（默认 500，不能太小）'
                }
            },
            required: ['direction']
        }
    },
    {
        name: 'bot_type_text',
        description: '输入文本。在文本末尾添加 \\n 可自动按回车。',
        inputSchema: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: '要输入的文本'
                }
            },
            required: ['text']
        }
    },
    {
        name: 'bot_hotkey',
        description: '按下快捷键组合。支持跨平台别名（如 "copy", "paste", "undo" 等会自动转换为当前平台的正确快捷键）。',
        inputSchema: {
            type: 'object',
            properties: {
                keys: {
                    type: 'string',
                    description: '快捷键组合，用空格或+分隔（如 "ctrl c", "cmd shift s"）。也支持别名（如 "copy", "paste", "undo", "save" 等）'
                }
            },
            required: ['keys']
        }
    },
    {
        name: 'bot_press_key',
        description: '按下按键（不释放）。',
        inputSchema: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: '按键名称'
                }
            },
            required: ['key']
        }
    },
    {
        name: 'bot_release_key',
        description: '释放按键。',
        inputSchema: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: '按键名称'
                }
            },
            required: ['key']
        }
    },
    {
        name: 'bot_activate_window',
        description: '根据进程名或窗口标题激活窗口（置顶显示）。建议先调用 bot_list_windows 获取可用窗口列表。',
        inputSchema: {
            type: 'object',
            properties: {
                processName: {
                    type: 'string',
                    description: '进程名称（如 "Feishu", "Chrome", "Safari"）'
                },
                title: {
                    type: 'string',
                    description: '窗口标题（可选，用于更精确匹配）'
                }
            },
            required: ['processName']
        }
    },
    {
        name: 'bot_get_window_info',
        description: '获取指定进程的窗口信息。',
        inputSchema: {
            type: 'object',
            properties: {
                processName: {
                    type: 'string',
                    description: '进程名称'
                }
            },
            required: ['processName']
        }
    },
    {
        name: 'bot_get_active_window',
        description: '获取当前活动窗口信息。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_list_windows',
        description: '列出所有打开的窗口（包括最小化的）。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_list_processes',
        description: '列出所有 GUI 进程（包括没有窗口的）。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_get_displays',
        description: '获取所有显示器信息。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_get_mouse_position',
        description: '获取当前鼠标位置。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_convert_bbox_to_screen',
        description: '将 bbox 坐标转换为屏幕像素坐标（用于调试）。',
        inputSchema: {
            type: 'object',
            properties: {
                bbox: {
                    type: 'string',
                    description: 'bbox 坐标字符串'
                },
                windowBounds: {
                    type: 'object',
                    description: '窗口边界信息',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' }
                    },
                    required: ['x', 'y', 'width', 'height']
                }
            },
            required: ['bbox', 'windowBounds']
        }
    },
    {
        name: 'bot_wait',
        description: '等待指定时间。',
        inputSchema: {
            type: 'object',
            properties: {
                ms: {
                    type: 'number',
                    description: '等待时间（毫秒），默认 1000'
                }
            }
        }
    },
    {
        name: 'bot_get_system_info',
        description: '获取当前系统平台信息（macOS/Windows/Linux）。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_get_hotkey_aliases',
        description: '获取支持的跨平台快捷键别名列表。使用别名可以自动适配当前平台（如 "copy" 在 Mac 上是 cmd+c，在 Windows 上是 ctrl+c）。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_list_apps',
        description: '获取电脑已安装的所有应用列表。支持 macOS 和 Windows。返回应用名称、版本、安装路径等信息。',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'bot_open_app',
        description: '启动指定应用程序。支持 macOS 和 Windows。',
        inputSchema: {
            type: 'object',
            properties: {
                appName: {
                    type: 'string',
                    description: '应用名称（如 "Visual Studio Code", "Google Chrome", "WeChat"）'
                }
            },
            required: ['appName']
        }
    },
    { name: 'ui_inspect', description: 'Inspect WPF visual tree', inputSchema: { type: 'object', properties: { processName: { type: 'string' } }, required: ['processName'] } },
    { name: 'ui_get_element', description: 'Get element by AutomationId', inputSchema: { type: 'object', properties: { processName: { type: 'string' }, automationId: { type: 'string' } }, required: ['processName', 'automationId'] } },
    { name: 'ui_set_text', description: 'Set text on element', inputSchema: { type: 'object', properties: { processName: { type: 'string' }, automationId: { type: 'string' }, text: { type: 'string' } }, required: ['processName', 'automationId', 'text'] } },
    { name: 'ui_invoke', description: 'Invoke button by AutomationId', inputSchema: { type: 'object', properties: { processName: { type: 'string' }, automationId: { type: 'string' } }, required: ['processName', 'automationId'] } },
];
// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'bot_screenshot': {
                const { processName, quality = SCREENSHOT_CONFIG.quality, maxWidth = SCREENSHOT_CONFIG.maxWidth } = args;
                const result = await screenshot.screenshotByProcess(processName, { quality, maxWidth });
                if (!result) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({ success: false, error: 'Screenshot failed' })
                            }],
                        isError: true
                    };
                }
                // MCP 标准格式：返回图片和元数据
                return {
                    content: [
                        {
                            type: 'image',
                            data: result.base64,
                            mimeType: 'image/jpeg'
                        },
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                width: result.width,
                                height: result.height,
                                scaleFactor: result.scaleFactor,
                                windowBounds: result.windowBounds
                            })
                        }
                    ]
                };
            }
            case 'bot_screenshot_fullscreen': {
                const { displayId, quality = SCREENSHOT_CONFIG.quality, maxWidth = SCREENSHOT_CONFIG.maxWidth } = args;
                const result = await screenshot.screenshotFullScreen(displayId, { quality, maxWidth });
                if (!result) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({ success: false, error: 'Screenshot failed' })
                            }],
                        isError: true
                    };
                }
                return {
                    content: [
                        {
                            type: 'image',
                            data: result.base64,
                            mimeType: 'image/jpeg'
                        },
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                width: result.width,
                                height: result.height,
                                scaleFactor: result.scaleFactor
                            })
                        }
                    ]
                };
            }
            case 'bot_click': {
                let { bbox, x, y, windowBounds, button = 'left', clickCount = 1 } = args;
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] [bot_click] 收到参数: bbox=${bbox}, windowBounds=${JSON.stringify(windowBounds)}, x=${x}, y=${y}`);
                // 如果 windowBounds 是字符串，尝试解析
                if (typeof windowBounds === 'string') {
                    console.error(`[${timestamp}] [bot_click] windowBounds 是字符串，尝试解析...`);
                    try {
                        windowBounds = JSON.parse(windowBounds);
                        console.error(`[${timestamp}] [bot_click] 解析成功: ${JSON.stringify(windowBounds)}`);
                    }
                    catch (e) {
                        console.error(`[${timestamp}] [bot_click] ⚠️ windowBounds 解析失败: ${e}`);
                        // 不要忽略，抛出错误
                        throw new Error(`Invalid windowBounds format: ${windowBounds}`);
                    }
                }
                // 验证 windowBounds 的有效性
                if (bbox && windowBounds) {
                    if (!windowBounds.x === undefined || windowBounds.y === undefined ||
                        !windowBounds.width || !windowBounds.height) {
                        console.error(`[${timestamp}] [bot_click] ⚠️ windowBounds 无效: ${JSON.stringify(windowBounds)}`);
                        throw new Error(`Invalid windowBounds: must have x, y, width, height. Got: ${JSON.stringify(windowBounds)}`);
                    }
                    // 检查 windowBounds 是否合理（不是默认值或异常值）
                    if (windowBounds.width === 0 || windowBounds.height === 0) {
                        console.error(`[${timestamp}] [bot_click] ⚠️ windowBounds 尺寸为 0，窗口可能最小化`);
                        throw new Error(`Window appears to be minimized (width or height is 0). Please activate the window first.`);
                    }
                }
                let coords;
                if (bbox && windowBounds) {
                    console.error(`[${timestamp}] [bot_click] 使用 bbox 点击: bbox=${bbox}, windowBounds=${JSON.stringify(windowBounds)}`);
                    coords = await inputController.clickByBBox(bbox, windowBounds, button, clickCount);
                    console.error(`[${timestamp}] [bot_click] 点击完成，实际坐标: ${JSON.stringify(coords)}`);
                }
                else if (x !== undefined && y !== undefined) {
                    console.error(`[${timestamp}] [bot_click] 使用像素坐标点击: x=${x}, y=${y}`);
                    await inputController.click(x, y, button, clickCount);
                    coords = { x, y };
                }
                else {
                    throw new Error('Must provide either bbox+windowBounds or x+y coordinates');
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, clickedAt: coords, windowBounds })
                        }]
                };
            }
            case 'bot_move_mouse': {
                let { bbox, x, y, windowBounds } = args;
                // 如果 windowBounds 是字符串，尝试解析
                if (typeof windowBounds === 'string') {
                    try {
                        windowBounds = JSON.parse(windowBounds);
                    }
                    catch (e) {
                        // ignore
                    }
                }
                let coords;
                if (bbox && windowBounds) {
                    const parsedBbox = parseBBox(bbox);
                    if (!parsedBbox)
                        throw new Error('Invalid bbox format');
                    coords = bboxToScreenCoords({ bbox: parsedBbox, windowBounds });
                    await inputController.moveMouse(coords.x, coords.y);
                }
                else if (x !== undefined && y !== undefined) {
                    await inputController.moveMouse(x, y);
                    coords = { x, y };
                }
                else {
                    throw new Error('Must provide either bbox+windowBounds or x+y coordinates');
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, movedTo: coords })
                        }]
                };
            }
            case 'bot_drag': {
                let { startBbox, endBbox, startX, startY, endX, endY, windowBounds } = args;
                // 如果 windowBounds 是字符串，尝试解析
                if (typeof windowBounds === 'string') {
                    try {
                        windowBounds = JSON.parse(windowBounds);
                    }
                    catch (e) {
                        // ignore
                    }
                }
                if (startBbox && endBbox && windowBounds) {
                    const result = await inputController.dragByBBox(startBbox, endBbox, windowBounds);
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({ success: true, ...result })
                            }]
                    };
                }
                else if (startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined) {
                    await inputController.drag(startX, startY, endX, endY);
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({ success: true, start: { x: startX, y: startY }, end: { x: endX, y: endY } })
                            }]
                    };
                }
                else {
                    throw new Error('Must provide either bbox coordinates or pixel coordinates');
                }
            }
            case 'bot_scroll': {
                const { direction, amount = 500 } = args;
                await inputController.scroll(direction, amount);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, direction, amount })
                        }]
                };
            }
            case 'bot_type_text': {
                const { text } = args;
                await inputController.typeText(text);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, typed: text })
                        }]
                };
            }
            case 'bot_hotkey': {
                const { keys } = args;
                await inputController.hotkey(keys);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, keys })
                        }]
                };
            }
            case 'bot_press_key': {
                const { key } = args;
                await inputController.pressKey(key);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, pressed: key })
                        }]
                };
            }
            case 'bot_release_key': {
                const { key } = args;
                await inputController.releaseKey(key);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, released: key })
                        }]
                };
            }
            case 'bot_activate_window': {
                const { processName, title } = args;
                const success = await windowManager.activateWindow(processName, title);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success, processName, title })
                        }]
                };
            }
            case 'bot_get_window_info': {
                const { processName } = args;
                const info = await windowManager.getWindowByProcess(processName);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: !!info, window: info })
                        }]
                };
            }
            case 'bot_get_active_window': {
                const info = await windowManager.getActiveWindow();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: !!info, window: info })
                        }]
                };
            }
            case 'bot_list_windows': {
                const windows = await windowManager.listWindows();
                const windowList = windows.map((w, i) => ({
                    index: i,
                    processName: w.owner.name,
                    title: w.title,
                    bounds: w.bounds,
                    isMinimized: w.bounds.width === 0 && w.bounds.height === 0
                }));
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: windows.length,
                                windows: windowList,
                                hint: '使用 bot_activate_window 传入 processName 来激活窗口。bounds 为 0 表示窗口可能最小化。'
                            }, null, 2)
                        }]
                };
            }
            case 'bot_list_processes': {
                const processes = await windowManager.listProcesses();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: processes.length,
                                processes,
                                hint: '这是所有 GUI 进程，使用 bot_activate_window 传入 name 来激活'
                            }, null, 2)
                        }]
                };
            }
            case 'bot_get_displays': {
                const displays = await screenshot.getDisplays();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, displays })
                        }]
                };
            }
            case 'bot_get_mouse_position': {
                const pos = await inputController.getMousePosition();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, position: pos })
                        }]
                };
            }
            case 'bot_convert_bbox_to_screen': {
                const { bbox, windowBounds } = args;
                const parsedBbox = parseBBox(bbox);
                if (!parsedBbox)
                    throw new Error('Invalid bbox format');
                const coords = bboxToScreenCoords({ bbox: parsedBbox, windowBounds });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, bbox: parsedBbox, screenCoords: coords, windowBounds })
                        }]
                };
            }
            case 'bot_wait': {
                const { ms = 1000 } = args;
                await new Promise(resolve => setTimeout(resolve, ms));
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({ success: true, waited: ms })
                        }]
                };
            }
            case 'bot_get_system_info': {
                const info = inputController.getSystemInfo();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                ...info,
                                hint: info.isMac
                                    ? '当前是 macOS，复制粘贴使用 cmd+c/cmd+v 或别名 "copy"/"paste"'
                                    : '当前是 Windows，复制粘贴使用 ctrl+c/ctrl+v 或别名 "copy"/"paste"'
                            })
                        }]
                };
            }
            case 'bot_get_hotkey_aliases': {
                const aliases = inputController.getSupportedHotkeyAliases();
                const info = inputController.getSystemInfo();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                platform: info.platform,
                                aliases,
                                hint: '使用 bot_hotkey 时可以直接传入别名（如 "copy"），会自动转换为当前平台的正确快捷键'
                            }, null, 2)
                        }]
                };
            }
            case 'bot_list_apps': {
                const apps = await getInstalledApps();
                const appList = apps.map((app) => ({
                    name: app.appName,
                    version: app.appVersion,
                    identifier: app.appIdentifier
                }));
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: apps.length,
                                apps: appList,
                                hint: '使用 bot_open_app 传入 name 来启动应用'
                            }, null, 2)
                        }]
                };
            }
            case 'bot_open_app': {
                const { appName } = args;
                // macOS: 先查找应用的实际文件名或 bundle id
                if (process.platform === 'darwin') {
                    const apps = await getInstalledApps();
                    const app = apps.find((a) => a.appName === appName ||
                        a.kMDItemFSName?.replace('.app', '') === appName ||
                        a.appIdentifier === appName);
                    if (app) {
                        // 用实际文件名启动
                        const realName = app.kMDItemFSName?.replace('.app', '') || appName;
                        await openApp(realName);
                        return {
                            content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: true,
                                        opened: appName,
                                        realName,
                                        hint: '应用已启动，建议等待 1-2 秒后调用 bot_list_windows 确认窗口已打开'
                                    })
                                }]
                        };
                    }
                }
                // Windows: 查找应用的安装路径
                if (process.platform === 'win32') {
                    const apps = await getInstalledApps();
                    const appNameLower = appName.toLowerCase();
                    const app = apps.find((a) => {
                        const name = (a.appName || '').toLowerCase();
                        const identifier = (a.appIdentifier || '').toLowerCase();
                        return name === appNameLower ||
                            name.includes(appNameLower) ||
                            appNameLower.includes(name) ||
                            identifier.includes(appNameLower);
                    });
                    if (app) {
                        // 优先从 DisplayIcon 获取 exe 路径（格式: "path.exe,0"）
                        let exePath = '';
                        if (app.DisplayIcon) {
                            exePath = app.DisplayIcon.split(',')[0].replace(/"/g, '');
                        }
                        // 如果有有效的 exe 路径，直接启动
                        if (exePath && exePath.endsWith('.exe')) {
                            await open(exePath);
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            opened: appName,
                                            path: exePath,
                                            hint: '应用已启动，建议等待 1-2 秒后调用 bot_list_windows 确认窗口已打开'
                                        })
                                    }]
                            };
                        }
                    }
                }
                // 未找到时直接用 appName
                await openApp(appName);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                opened: appName,
                                hint: '应用已启动，建议等待 1-2 秒后调用 bot_list_windows 确认窗口已打开'
                            })
                        }]
                };
            }
            case 'ui_inspect': { const r = await wpfInspect.uiInspect(args.processName); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
            case 'ui_get_element': { const r = await wpfInspect.uiGetElement(args.processName, args.automationId); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
            case 'ui_set_text': { const r = await wpfInspect.uiSetText(args.processName, args.automationId, args.text); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
            case 'ui_invoke': { const r = await wpfInspect.uiInvoke(args.processName, args.automationId); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: false, error: errorMessage })
                }],
            isError: true
        };
    }
});
// 启动服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Desktop Automation MCP Server started');
}
main().catch(console.error);
//# sourceMappingURL=index.js.map
