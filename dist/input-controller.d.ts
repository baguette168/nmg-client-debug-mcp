/**
 * Input Controller - 鼠标键盘控制模块
 * 使用 @nut-tree/nut-js 实现跨平台控制
 */
import type { MouseButton, ScrollDirection, ScreenCoords } from './types.js';
/**
 * 移动鼠标到指定位置
 */
export declare function moveMouse(x: number, y: number): Promise<void>;
/**
 * 鼠标点击
 */
export declare function click(x: number, y: number, button?: MouseButton, clickCount?: number): Promise<void>;
/**
 * 根据 bbox 和窗口信息点击
 */
export declare function clickByBBox(bboxStr: string, windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}, button?: MouseButton, clickCount?: number): Promise<ScreenCoords>;
/**
 * 鼠标拖拽
 */
export declare function drag(startX: number, startY: number, endX: number, endY: number): Promise<void>;
/**
 * 根据 bbox 拖拽
 */
export declare function dragByBBox(startBBoxStr: string, endBBoxStr: string, windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}): Promise<{
    start: ScreenCoords;
    end: ScreenCoords;
}>;
/**
 * 滚动鼠标（在当前鼠标位置滚动，不移动鼠标）
 */
export declare function scroll(direction: ScrollDirection, amount?: number): Promise<void>;
/**
 * 输入文本
 */
export declare function typeText(text: string): Promise<void>;
/**
 * 按下快捷键（支持别名和跨平台）
 *
 * 支持的格式：
 * - 直接按键: "ctrl c", "cmd v", "alt tab"
 * - 别名: "copy", "paste", "undo", "save" 等（自动转换为当前平台的快捷键）
 */
export declare function hotkey(keyStr: string): Promise<void>;
/**
 * 获取当前系统平台信息
 */
export declare function getSystemInfo(): {
    platform: 'macos' | 'windows' | 'linux';
    isMac: boolean;
    isWindows: boolean;
    isLinux: boolean;
};
/**
 * 获取支持的快捷键别名列表
 */
export declare function getSupportedHotkeyAliases(): Record<string, string>;
/**
 * 按下按键（不释放）
 */
export declare function pressKey(keyStr: string): Promise<void>;
/**
 * 释放按键
 */
export declare function releaseKey(keyStr: string): Promise<void>;
/**
 * 获取当前鼠标位置
 */
export declare function getMousePosition(): Promise<ScreenCoords>;
//# sourceMappingURL=input-controller.d.ts.map