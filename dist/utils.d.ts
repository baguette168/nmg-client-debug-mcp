/**
 * Utility functions for coordinate conversion and helpers
 */
import type { BBox, ScreenCoords, CoordConvertParams } from './types.js';
export declare const DEFAULT_FACTOR = 1000;
/**
 * 将 bbox (0-1000 归一化坐标) 转换为屏幕像素坐标
 *
 * 流程:
 * 1. bbox 是模型输出的 0-1000 归一化坐标
 * 2. 先转换为 0-1 归一化坐标
 * 3. 再根据窗口尺寸转换为窗口内的像素坐标
 * 4. 最后加上窗口在屏幕中的偏移量，得到屏幕绝对坐标
 */
export declare function bboxToScreenCoords(params: CoordConvertParams): ScreenCoords;
/**
 * 解析 bbox 字符串
 * 支持格式: "x1 y1 x2 y2" 或 "[x1, y1, x2, y2]" 或 "<bbox>x1 y1 x2 y2</bbox>"
 */
export declare function parseBBox(bboxStr: string): BBox | null;
/**
 * 延迟函数
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * 获取平台信息
 */
export declare function getPlatform(): 'darwin' | 'win32' | 'linux';
/**
 * 检查是否为 macOS
 */
export declare function isMacOS(): boolean;
/**
 * 检查是否为 Windows
 */
export declare function isWindows(): boolean;
//# sourceMappingURL=utils.d.ts.map