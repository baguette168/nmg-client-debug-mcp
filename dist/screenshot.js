/**
 * Screenshot Module - 截图模块
 * 支持按进程名截取特定窗口
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { Jimp } from 'jimp';
import { isMacOS, isWindows } from './utils.js';
import { SCREENSHOT_CONFIG } from './config.js';
import { getWindowByProcess, getActiveWindow, matchesProcessName, getProcessNameAliases } from './window-manager.js';
import { openWindows } from 'get-windows';
const execAsync = promisify(exec);
// get-windows 配置：不需要 url，需要 title
const getWindowsOptions = { accessibilityPermission: false, screenRecordingPermission: true };
/**
 * 获取所有显示器信息
 */
export async function getDisplays() {
    try {
        // 使用 node-screenshots 获取显示器信息
        const screenshots = await import('node-screenshots');
        const monitors = screenshots.Monitor.all();
        return monitors.map((monitor, index) => ({
            id: monitor.id,
            name: monitor.name || `Display ${index + 1}`,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            scaleFactor: monitor.scaleFactor,
            isPrimary: monitor.isPrimary
        }));
    }
    catch (error) {
        console.error('Failed to get displays:', error);
        // 返回默认显示器
        return [{
                id: 0,
                name: 'Primary Display',
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                scaleFactor: 1,
                isPrimary: true
            }];
    }
}
/**
 * 根据进程名截取窗口截图
 */
export async function screenshotByProcess(processName, options = {}) {
    const { quality = SCREENSHOT_CONFIG.quality, maxWidth = SCREENSHOT_CONFIG.maxWidth } = options;
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [bot_screenshot] 开始截图, processName: ${processName}`);
    try {
        // 注意：不再激活窗口，保持当前桌面状态不变
        // 这样可以截取到鼠标光标位置、右键菜单等浮层信息
        let image;
        let windowBounds = { x: 0, y: 0, width: 800, height: 600 };
        let scaleFactor = 1;
        if (isMacOS()) {
            // macOS: 使用窗口 ID 直接截图，避免坐标问题
            let windowId = null;
            // 方法1: 使用 get-windows 包获取窗口信息（跨平台，不依赖 Python）
            try {
                const windows = await openWindows(getWindowsOptions);
                const matchingWindows = windows.filter(w => matchesProcessName(w.owner.name, w.title, processName));
                console.error(`[${timestamp}] [bot_screenshot] 找到 ${matchingWindows.length} 个匹配窗口 (processName="${processName}", aliases=${JSON.stringify(getProcessNameAliases(processName))})`);
                if (matchingWindows.length > 0) {
                    // 选择面积最大的窗口（主窗口通常最大）
                    const targetWindow = matchingWindows.reduce((largest, current) => {
                        const largestArea = largest.bounds.width * largest.bounds.height;
                        const currentArea = current.bounds.width * current.bounds.height;
                        return currentArea > largestArea ? current : largest;
                    });
                    // 打印所有匹配窗口的信息，方便调试
                    matchingWindows.forEach((w, i) => {
                        const area = w.bounds.width * w.bounds.height;
                        const isSelected = w.id === targetWindow.id;
                        console.error(`[${timestamp}] [bot_screenshot]   窗口${i}: id=${w.id}, title="${w.title}", bounds=${w.bounds.width}x${w.bounds.height}, area=${area}${isSelected ? ' ← 已选择' : ''}`);
                    });
                    windowId = targetWindow.id;
                    windowBounds = {
                        x: targetWindow.bounds.x,
                        y: targetWindow.bounds.y,
                        width: targetWindow.bounds.width,
                        height: targetWindow.bounds.height
                    };
                    console.error(`[${timestamp}] [bot_screenshot] 选择最大窗口: id=${windowId}, bounds=${JSON.stringify(windowBounds)}`);
                }
            }
            catch (e) {
                console.error(`[${timestamp}] [bot_screenshot] get-windows 获取窗口信息失败:`, e);
            }
            // 方法2: 如果 get-windows 失败，尝试 AppleScript 获取窗口位置（遍历所有别名）
            if (!windowId) {
                const namesToTry = getProcessNameAliases(processName);
                if (!namesToTry.includes(processName.toLowerCase())) {
                    namesToTry.unshift(processName);
                }
                for (const tryName of namesToTry) {
                    const windowInfoScript = `tell application "System Events"
tell process "${tryName}"
if (count of windows) > 0 then
set frontWin to first window
set winPos to position of frontWin
set winSize to size of frontWin
return (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize)
end if
end tell
end tell`;
                    try {
                        const { stdout } = await execAsync(`osascript -e '${windowInfoScript}'`);
                        const parts = stdout.trim().split(',').map(n => parseInt(n.trim()));
                        if (parts.length >= 4 && !isNaN(parts[0])) {
                            windowBounds = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
                            console.error(`[${timestamp}] [bot_screenshot] AppleScript 窗口位置 (name="${tryName}"): bounds=${JSON.stringify(windowBounds)}`);
                            break;
                        }
                    }
                    catch (e) {
                        continue;
                    }
                }
            }
            const tmpFile = `/tmp/screenshot_${Date.now()}.png`;
            // 如果没有找到窗口位置，尝试从活动窗口获取
            if (!windowBounds || (windowBounds.width === 0 && windowBounds.height === 0)) {
                const activeWindow = await getActiveWindow();
                if (!activeWindow) {
                    throw new Error(`Window not found for process: ${processName}`);
                }
                windowBounds = activeWindow.bounds;
            }
            // 使用屏幕区域截图（-C 包含鼠标光标，-R 截取屏幕区域而非窗口图层）
            // 这样可以截取到右键菜单、Tooltip 等浮层信息
            const { x, y, width, height } = windowBounds;
            const cmd = `screencapture -C -R${x},${y},${width},${height} -x ${tmpFile}`;
            console.error(`[${timestamp}] [bot_screenshot] 使用区域截图（含光标和浮层）: ${cmd}`);
            await execAsync(cmd);
            // 读取截图
            image = await Jimp.read(tmpFile);
            console.error(`[${timestamp}] [bot_screenshot] 截图读取成功, 图片尺寸: ${image.width}x${image.height}`);
            // 删除临时文件
            await execAsync(`rm -f ${tmpFile}`);
            // 获取显示器 scaleFactor
            const displays = await getDisplays();
            const display = displays.find(d => windowBounds.x >= d.x && windowBounds.x < d.x + d.width &&
                windowBounds.y >= d.y && windowBounds.y < d.y + d.height) || displays[0];
            scaleFactor = display?.scaleFactor || 1;
        }
        else if (isWindows()) {
            // Windows: 安全整数转换工具，防止 undefined/NaN 导致后续 crop 崩溃
            const safeInt = (v, fallback = 0) => {
                const n = Number(v);
                return isFinite(n) ? Math.round(n) : fallback;
            };
            // Windows: 优先使用 PowerShell 脚本获取（更可靠），get-windows 作为备用
            let winInfoFromPS = null;
            try {
                const winInfo = await getWindowByProcess(processName);
                if (winInfo && winInfo.bounds.width > 0 && winInfo.bounds.height > 0) {
                    winInfoFromPS = winInfo.bounds;
                    console.error(`[${timestamp}] [bot_screenshot] PowerShell/get-windows 返回: bounds=${JSON.stringify(winInfo.bounds)}`);
                }
            }
            catch (e) {
                console.error(`[${timestamp}] [bot_screenshot] getWindowByProcess 失败:`, e);
            }
            if (winInfoFromPS) {
                windowBounds = {
                    x: safeInt(winInfoFromPS.x),
                    y: safeInt(winInfoFromPS.y),
                    width: safeInt(winInfoFromPS.width, 800),
                    height: safeInt(winInfoFromPS.height, 600),
                };
            }
            else {
                // 尝试 get-windows 作为备用
                try {
                    const windows = await openWindows(getWindowsOptions);
                    const matchingWindows = windows.filter(w => matchesProcessName(w.owner.name, w.title, processName));
                    console.error(`[${timestamp}] [bot_screenshot] 找到 ${matchingWindows.length} 个匹配窗口 (processName="${processName}", aliases=${JSON.stringify(getProcessNameAliases(processName))})`);
                    if (matchingWindows.length > 0) {
                        // 选择面积最大的窗口（主窗口通常最大）
                        const targetWindow = matchingWindows.reduce((largest, current) => {
                            const largestArea = largest.bounds.width * largest.bounds.height;
                            const currentArea = current.bounds.width * current.bounds.height;
                            return currentArea > largestArea ? current : largest;
                        });
                        // 打印所有匹配窗口的信息
                        matchingWindows.forEach((w, i) => {
                            const area = w.bounds.width * w.bounds.height;
                            const isSelected = w === targetWindow;
                            console.error(`[${timestamp}] [bot_screenshot]   窗口${i}: title="${w.title}", bounds=${w.bounds.width}x${w.bounds.height}, area=${area}${isSelected ? ' ← 已选择' : ''}`);
                        });
                        windowBounds = {
                            x: safeInt(targetWindow.bounds.x),
                            y: safeInt(targetWindow.bounds.y),
                            width: safeInt(targetWindow.bounds.width, 800),
                            height: safeInt(targetWindow.bounds.height, 600),
                        };
                        console.error(`[${timestamp}] [bot_screenshot] 选择最大窗口: bounds=${JSON.stringify(windowBounds)}`);
                    }
                    else {
                        throw new Error(`Window not found for process: ${processName}`);
                    }
                }
                catch (e) {
                    console.error(`[${timestamp}] [bot_screenshot] get-windows 获取失败:`, e);
                    throw new Error(`Window not found for process: ${processName}`);
                }
            }
            // Windows: 使用 node-screenshots
            const screenshots = await import('node-screenshots');
            const monitors = screenshots.Monitor.all();
            // 找到包含窗口的显示器
            const monitor = monitors.find((m) => windowBounds.x >= m.x && windowBounds.x < m.x + m.width) || monitors[0];
            scaleFactor = monitor.scaleFactor || 1;
            // 截取整个显示器
            const screenshotData = monitor.captureImageSync();
            // 裁剪到窗口区域
            image = await Jimp.read(Buffer.from(screenshotData.toPngSync()));
            // 计算相对于显示器的坐标（全部做 NaN 防护）
            const rawRelX = (windowBounds.x - safeInt(monitor.x)) * scaleFactor;
            const rawRelY = (windowBounds.y - safeInt(monitor.y)) * scaleFactor;
            const relX = Math.max(0, isFinite(rawRelX) ? rawRelX : 0);
            const relY = Math.max(0, isFinite(rawRelY) ? rawRelY : 0);
            const rawCropW = windowBounds.width * scaleFactor;
            const rawCropH = windowBounds.height * scaleFactor;
            const cropW = Math.min(isFinite(rawCropW) ? rawCropW : image.width, image.width - relX);
            const cropH = Math.min(isFinite(rawCropH) ? rawCropH : image.height, image.height - relY);
            console.error(`[${timestamp}] [bot_screenshot] crop 参数: relX=${relX}, relY=${relY}, cropW=${cropW}, cropH=${cropH}, scaleFactor=${scaleFactor}`);
            // 只有当裁剪区域有效时才裁剪，否则使用整张截图
            if (cropW > 0 && cropH > 0) {
                image.crop({ x: Math.round(relX), y: Math.round(relY), w: Math.round(cropW), h: Math.round(cropH) });
            }
            else {
                console.error(`[${timestamp}] [bot_screenshot] ⚠️ 裁剪区域无效，使用整张截图`);
            }
            // 缩放到逻辑分辨率
            if (scaleFactor > 1) {
                image.resize({ w: windowBounds.width, h: windowBounds.height });
            }
        }
        else {
            return null;
        }
        // 计算输出尺寸
        let outputWidth = image.width;
        let outputHeight = image.height;
        // 如果超过最大宽度，等比缩放
        if (outputWidth > maxWidth) {
            const ratio = maxWidth / outputWidth;
            outputWidth = maxWidth;
            outputHeight = Math.round(image.height * ratio);
            console.error(`[${timestamp}] [bot_screenshot] 图片缩放: ${image.width}x${image.height} -> ${outputWidth}x${outputHeight}`);
            image.resize({ w: outputWidth, h: outputHeight });
        }
        // 转换为 JPEG 并压缩
        const buffer = await image.getBuffer('image/jpeg', { quality });
        console.error(`[${timestamp}] [bot_screenshot] 截图完成, 输出尺寸: ${outputWidth}x${outputHeight}, windowBounds:`, JSON.stringify(windowBounds));
        return {
            base64: buffer.toString('base64'),
            width: outputWidth,
            height: outputHeight,
            scaleFactor,
            windowBounds
        };
    }
    catch (error) {
        console.error(`[${timestamp}] [bot_screenshot] 截图失败:`, error);
        throw error;
    }
}
/**
 * 截取整个屏幕
 */
export async function screenshotFullScreen(displayId, options = {}) {
    const { quality = SCREENSHOT_CONFIG.quality, maxWidth = SCREENSHOT_CONFIG.maxWidth } = options;
    try {
        const screenshots = await import('node-screenshots');
        const monitors = screenshots.Monitor.all();
        const monitor = displayId !== undefined
            ? monitors.find((m) => m.id === displayId) || monitors[0]
            : monitors.find((m) => m.isPrimary) || monitors[0];
        const screenshotData = monitor.captureImageSync();
        let image = await Jimp.read(Buffer.from(screenshotData.toPngSync()));
        // 缩放到逻辑分辨率
        const scaleFactor = monitor.scaleFactor;
        let logicalWidth = Math.round(image.width / scaleFactor);
        let logicalHeight = Math.round(image.height / scaleFactor);
        if (scaleFactor > 1) {
            image.resize({ w: logicalWidth, h: logicalHeight });
        }
        // 如果超过最大宽度，等比缩放
        if (logicalWidth > maxWidth) {
            const ratio = maxWidth / logicalWidth;
            logicalWidth = maxWidth;
            logicalHeight = Math.round(logicalHeight * ratio);
            image.resize({ w: logicalWidth, h: logicalHeight });
        }
        // 转换为 JPEG 并压缩
        const buffer = await image.getBuffer('image/jpeg', { quality });
        return {
            base64: buffer.toString('base64'),
            width: logicalWidth,
            height: logicalHeight,
            scaleFactor
        };
    }
    catch (error) {
        console.error('Failed to screenshot full screen:', error);
        throw error;
    }
}
//# sourceMappingURL=screenshot.js.map