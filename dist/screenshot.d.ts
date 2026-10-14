/**
 * Screenshot Module - 截图模块
 * 支持按进程名截取特定窗口
 */
import type { ScreenshotOutput, DisplayInfo } from './types.js';
export interface ScreenshotOptions {
    quality?: number;
    maxWidth?: number;
}
/**
 * 获取所有显示器信息
 */
export declare function getDisplays(): Promise<DisplayInfo[]>;
/**
 * 根据进程名截取窗口截图
 */
export declare function screenshotByProcess(processName: string, options?: ScreenshotOptions): Promise<ScreenshotOutput | null>;
/**
 * 截取整个屏幕
 */
export declare function screenshotFullScreen(displayId?: number, options?: ScreenshotOptions): Promise<ScreenshotOutput | null>;
//# sourceMappingURL=screenshot.d.ts.map