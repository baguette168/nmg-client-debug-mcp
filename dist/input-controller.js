/**
 * Input Controller - 鼠标键盘控制模块
 * 使用 @nut-tree/nut-js 实现跨平台控制
 */
import { mouse, keyboard, Button, Key, Point, straightTo, clipboard } from '@computer-use/nut-js';
import { bboxToScreenCoords, parseBBox, sleep, isMacOS, isWindows } from './utils.js';
// 配置鼠标速度
mouse.config.mouseSpeed = 2000;
keyboard.config.autoDelayMs = 50;
/**
 * 获取平台相关的键盘映射
 * Mac: ctrl -> Cmd, alt -> Option
 * Windows: ctrl -> Control, alt -> Alt
 */
function getKeyMap() {
    const isMac = isMacOS();
    return {
        // 特殊键
        'enter': Key.Enter,
        'return': Key.Enter,
        'tab': Key.Tab,
        'space': Key.Space,
        'backspace': Key.Backspace,
        'delete': Key.Delete,
        'escape': Key.Escape,
        'esc': Key.Escape,
        // 修饰键 - 平台适配
        'shift': Key.LeftShift,
        'ctrl': isMac ? Key.LeftCmd : Key.LeftControl, // Mac: Cmd, Win: Ctrl
        'control': Key.LeftControl, // 强制使用 Control
        'alt': Key.LeftAlt,
        'option': Key.LeftAlt, // Mac Option 键
        'meta': isMac ? Key.LeftCmd : Key.LeftWin,
        'cmd': Key.LeftCmd,
        'command': Key.LeftCmd,
        'win': Key.LeftWin,
        'super': isMac ? Key.LeftCmd : Key.LeftWin, // 通用超级键
        // 方向键
        'up': Key.Up,
        'down': Key.Down,
        'left': Key.Left,
        'right': Key.Right,
        'arrowup': Key.Up,
        'arrowdown': Key.Down,
        'arrowleft': Key.Left,
        'arrowright': Key.Right,
        // 功能键
        'f1': Key.F1,
        'f2': Key.F2,
        'f3': Key.F3,
        'f4': Key.F4,
        'f5': Key.F5,
        'f6': Key.F6,
        'f7': Key.F7,
        'f8': Key.F8,
        'f9': Key.F9,
        'f10': Key.F10,
        'f11': Key.F11,
        'f12': Key.F12,
        // 其他
        'home': Key.Home,
        'end': Key.End,
        'pageup': Key.PageUp,
        'pagedown': Key.PageDown,
        'insert': Key.Insert,
        'capslock': Key.CapsLock,
        // 符号键
        ',': Key.Comma,
        '.': Key.Period,
        '/': Key.Slash,
        ';': Key.Semicolon,
        "'": Key.Quote,
        '[': Key.LeftBracket,
        ']': Key.RightBracket,
        '\\': Key.Backslash,
        '-': Key.Minus,
        '=': Key.Equal,
        '`': Key.Grave,
    };
}
/**
 * 常用快捷键别名映射（跨平台）
 * 自动转换为当前平台的正确快捷键
 */
function getHotkeyAliases() {
    const isMac = isMacOS();
    return {
        // 复制粘贴剪切
        'copy': isMac ? 'cmd c' : 'ctrl c',
        'paste': isMac ? 'cmd v' : 'ctrl v',
        'cut': isMac ? 'cmd x' : 'ctrl x',
        'selectall': isMac ? 'cmd a' : 'ctrl a',
        'select_all': isMac ? 'cmd a' : 'ctrl a',
        // 撤销重做
        'undo': isMac ? 'cmd z' : 'ctrl z',
        'redo': isMac ? 'cmd shift z' : 'ctrl y',
        // 保存
        'save': isMac ? 'cmd s' : 'ctrl s',
        'saveas': isMac ? 'cmd shift s' : 'ctrl shift s',
        'save_as': isMac ? 'cmd shift s' : 'ctrl shift s',
        // 查找替换
        'find': isMac ? 'cmd f' : 'ctrl f',
        'replace': isMac ? 'cmd h' : 'ctrl h',
        'findnext': isMac ? 'cmd g' : 'f3',
        'find_next': isMac ? 'cmd g' : 'f3',
        // 窗口操作
        'close': isMac ? 'cmd w' : 'ctrl w',
        'closewindow': isMac ? 'cmd shift w' : 'alt f4',
        'close_window': isMac ? 'cmd shift w' : 'alt f4',
        'quit': isMac ? 'cmd q' : 'alt f4',
        'newtab': isMac ? 'cmd t' : 'ctrl t',
        'new_tab': isMac ? 'cmd t' : 'ctrl t',
        'newwindow': isMac ? 'cmd n' : 'ctrl n',
        'new_window': isMac ? 'cmd n' : 'ctrl n',
        // 刷新
        'refresh': isMac ? 'cmd r' : 'ctrl r',
        'reload': isMac ? 'cmd r' : 'ctrl r',
        'hardrefresh': isMac ? 'cmd shift r' : 'ctrl shift r',
        'hard_refresh': isMac ? 'cmd shift r' : 'ctrl shift r',
        // 切换应用/标签
        'switchtab': isMac ? 'ctrl tab' : 'ctrl tab',
        'switch_tab': isMac ? 'ctrl tab' : 'ctrl tab',
        'switchapp': isMac ? 'cmd tab' : 'alt tab',
        'switch_app': isMac ? 'cmd tab' : 'alt tab',
        // 其他常用
        'print': isMac ? 'cmd p' : 'ctrl p',
        'bold': isMac ? 'cmd b' : 'ctrl b',
        'italic': isMac ? 'cmd i' : 'ctrl i',
        'underline': isMac ? 'cmd u' : 'ctrl u',
    };
}
/**
 * 解析按键字符串为 Key 数组
 */
function parseKeys(keyStr) {
    const keyMap = getKeyMap();
    const keys = keyStr.toLowerCase().split(/[\s+]+/).filter(Boolean);
    const result = [];
    for (const k of keys) {
        if (keyMap[k]) {
            result.push(keyMap[k]);
        }
        else if (k.length === 1) {
            // 单个字符，尝试映射
            const upperKey = k.toUpperCase();
            if (Key[upperKey] !== undefined) {
                result.push(Key[upperKey]);
            }
        }
    }
    return result;
}
/**
 * 解析快捷键（支持别名）
 */
function resolveHotkey(keyStr) {
    const aliases = getHotkeyAliases();
    const normalized = keyStr.toLowerCase().replace(/[\s_-]+/g, '').trim();
    // 检查是否是别名
    if (aliases[normalized]) {
        return aliases[normalized];
    }
    return keyStr;
}
/**
 * 移动鼠标到指定位置
 */
export async function moveMouse(x, y) {
    await mouse.move(straightTo(new Point(x, y)));
}
/**
 * 鼠标点击
 */
export async function click(x, y, button = 'left', clickCount = 1) {
    await moveMouse(x, y);
    await sleep(100);
    const btn = button === 'left' ? Button.LEFT
        : button === 'right' ? Button.RIGHT
            : Button.MIDDLE;
    if (clickCount === 2) {
        await mouse.doubleClick(btn);
    }
    else {
        await mouse.click(btn);
    }
}
/**
 * 根据 bbox 和窗口信息点击
 */
export async function clickByBBox(bboxStr, windowBounds, button = 'left', clickCount = 1) {
    const bbox = parseBBox(bboxStr);
    if (!bbox) {
        throw new Error(`Invalid bbox format: ${bboxStr}`);
    }
    const coords = bboxToScreenCoords({ bbox, windowBounds });
    await click(coords.x, coords.y, button, clickCount);
    return coords;
}
/**
 * 鼠标拖拽
 */
export async function drag(startX, startY, endX, endY) {
    await moveMouse(startX, startY);
    await sleep(100);
    await mouse.drag(straightTo(new Point(endX, endY)));
}
/**
 * 根据 bbox 拖拽
 */
export async function dragByBBox(startBBoxStr, endBBoxStr, windowBounds) {
    const startBBox = parseBBox(startBBoxStr);
    const endBBox = parseBBox(endBBoxStr);
    if (!startBBox || !endBBox) {
        throw new Error('Invalid bbox format');
    }
    const startCoords = bboxToScreenCoords({ bbox: startBBox, windowBounds });
    const endCoords = bboxToScreenCoords({ bbox: endBBox, windowBounds });
    await drag(startCoords.x, startCoords.y, endCoords.x, endCoords.y);
    return { start: startCoords, end: endCoords };
}
/**
 * 滚动鼠标（在当前鼠标位置滚动，不移动鼠标）
 */
export async function scroll(direction, amount = 500) {
    switch (direction) {
        case 'up':
            await mouse.scrollUp(amount);
            break;
        case 'down':
            await mouse.scrollDown(amount);
            break;
        case 'left':
            await mouse.scrollLeft(amount);
            break;
        case 'right':
            await mouse.scrollRight(amount);
            break;
    }
}
/**
 * 输入文本
 */
export async function typeText(text) {
    const content = text.replace(/\\n$/, '').replace(/\n$/, '');
    if (isWindows()) {
        // Windows: 使用剪贴板方式输入（更可靠，支持中文）
        try {
            await clipboard.setContent(content);
            await sleep(50);
            await keyboard.pressKey(Key.LeftControl, Key.V);
            await sleep(100);
            await keyboard.releaseKey(Key.LeftControl, Key.V);
            await sleep(50);
        }
        catch (e) {
            // 剪贴板失败时回退到直接输入
            console.error('[typeText] 剪贴板方式失败，回退到直接输入:', e);
            await keyboard.type(content);
        }
    }
    else {
        await keyboard.type(content);
    }
    // 如果原文本以换行结尾，按回车
    if (text.endsWith('\n') || text.endsWith('\\n')) {
        await keyboard.pressKey(Key.Enter);
        await keyboard.releaseKey(Key.Enter);
    }
}
/**
 * 按下快捷键（支持别名和跨平台）
 *
 * 支持的格式：
 * - 直接按键: "ctrl c", "cmd v", "alt tab"
 * - 别名: "copy", "paste", "undo", "save" 等（自动转换为当前平台的快捷键）
 */
export async function hotkey(keyStr) {
    // 解析别名
    const resolved = resolveHotkey(keyStr);
    const keys = parseKeys(resolved);
    if (keys.length > 0) {
        await keyboard.pressKey(...keys);
        await sleep(50); // 增加延迟确保按键被识别
        await keyboard.releaseKey(...keys);
    }
}
/**
 * 获取当前系统平台信息
 */
export function getSystemInfo() {
    return {
        platform: isMacOS() ? 'macos' : isWindows() ? 'windows' : 'linux',
        isMac: isMacOS(),
        isWindows: isWindows(),
        isLinux: !isMacOS() && !isWindows()
    };
}
/**
 * 获取支持的快捷键别名列表
 */
export function getSupportedHotkeyAliases() {
    return getHotkeyAliases();
}
/**
 * 按下按键（不释放）
 */
export async function pressKey(keyStr) {
    const keys = parseKeys(keyStr);
    if (keys.length > 0) {
        await keyboard.pressKey(...keys);
    }
}
/**
 * 释放按键
 */
export async function releaseKey(keyStr) {
    const keys = parseKeys(keyStr);
    if (keys.length > 0) {
        await keyboard.releaseKey(...keys);
    }
}
/**
 * 获取当前鼠标位置
 */
export async function getMousePosition() {
    const pos = await mouse.getPosition();
    return { x: pos.x, y: pos.y };
}
//# sourceMappingURL=input-controller.js.map