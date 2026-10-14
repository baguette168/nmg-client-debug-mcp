/**
 * Utility functions for coordinate conversion and helpers
 */
// 默认归一化因子 (模型输出 0-1000 范围)
export const DEFAULT_FACTOR = 1000;
/**
 * 将 bbox (0-1000 归一化坐标) 转换为屏幕像素坐标
 *
 * 流程:
 * 1. bbox 是模型输出的 0-1000 归一化坐标
 * 2. 先转换为 0-1 归一化坐标
 * 3. 再根据窗口尺寸转换为窗口内的像素坐标
 * 4. 最后加上窗口在屏幕中的偏移量，得到屏幕绝对坐标
 */
export function bboxToScreenCoords(params) {
    const { bbox, windowBounds, scaleFactor = 1 } = params;
    const { x1, y1, x2, y2 } = bbox;
    const { x: winX, y: winY, width: winWidth, height: winHeight } = windowBounds;
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [bboxToScreenCoords] 输入: bbox=(${x1},${y1},${x2},${y2}), windowBounds=(x=${winX},y=${winY},w=${winWidth},h=${winHeight})`);
    // 计算 bbox 中心点 (0-1000 范围)
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    console.error(`[${timestamp}] [bboxToScreenCoords] bbox 中心点 (0-1000): (${centerX}, ${centerY})`);
    // 转换为 0-1 归一化坐标
    const normalizedX = centerX / DEFAULT_FACTOR;
    const normalizedY = centerY / DEFAULT_FACTOR;
    console.error(`[${timestamp}] [bboxToScreenCoords] 归一化坐标 (0-1): (${normalizedX}, ${normalizedY})`);
    // 转换为窗口内的像素坐标
    const windowPixelX = normalizedX * winWidth;
    const windowPixelY = normalizedY * winHeight;
    console.error(`[${timestamp}] [bboxToScreenCoords] 窗口内像素坐标: (${windowPixelX}, ${windowPixelY})`);
    // 加上窗口偏移量，得到屏幕绝对坐标
    const screenX = Math.round(winX + windowPixelX);
    const screenY = Math.round(winY + windowPixelY);
    console.error(`[${timestamp}] [bboxToScreenCoords] 最终屏幕坐标: (${screenX}, ${screenY})`);
    // 安全检查：如果计算出的坐标明显不合理，发出警告
    if (screenX < 0 || screenY < 0) {
        console.error(`[${timestamp}] [bboxToScreenCoords] ⚠️ 警告: 计算出的坐标为负数！可能 windowBounds 有问题`);
    }
    if (screenX > 10000 || screenY > 10000) {
        console.error(`[${timestamp}] [bboxToScreenCoords] ⚠️ 警告: 计算出的坐标异常大！可能 windowBounds 有问题`);
    }
    return { x: screenX, y: screenY };
}
/**
 * 解析 bbox 字符串
 * 支持格式: "x1 y1 x2 y2" 或 "[x1, y1, x2, y2]" 或 "<bbox>x1 y1 x2 y2</bbox>"
 */
export function parseBBox(bboxStr) {
    // 移除 <bbox> 标签
    let cleaned = bboxStr.replace(/<\/?bbox>/g, '').trim();
    // 移除方括号
    cleaned = cleaned.replace(/[\[\]]/g, '');
    // 分割数字
    const numbers = cleaned.split(/[\s,]+/).map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
    if (numbers.length < 4) {
        return null;
    }
    return {
        x1: numbers[0],
        y1: numbers[1],
        x2: numbers[2],
        y2: numbers[3]
    };
}
/**
 * 延迟函数
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 获取平台信息
 */
export function getPlatform() {
    return process.platform;
}
/**
 * 检查是否为 macOS
 */
export function isMacOS() {
    return process.platform === 'darwin';
}
/**
 * 检查是否为 Windows
 */
export function isWindows() {
    return process.platform === 'win32';
}
//# sourceMappingURL=utils.js.map