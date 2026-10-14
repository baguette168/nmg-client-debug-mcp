/**
 * Window Manager - 窗口管理模块
 * 支持 macOS 和 Windows
 */
import type { WindowInfo } from './types.js';
interface ProcessInfo {
    name: string;
    pid: number;
    ppid?: number;
}
/**
 * Get all known alias names for a given process name.
 * Returns the alias group if found, otherwise returns [processName] itself.
 */
export declare function getProcessNameAliases(processName: string): string[];
/**
 * Check if a window matches the given process name.
 * Supports substring matching (existing) + alias-based matching (new).
 */
export declare function matchesProcessName(ownerName: string, windowTitle: string, processName: string): boolean;
/**
 * 根据进程名激活窗口（置顶）
 * @param processName 进程名称
 * @param title 窗口标题（可选，用于更精确匹配）
 */
export declare function activateWindow(processName: string, title?: string): Promise<boolean>;
/**
 * 获取当前活动窗口信息
 */
export declare function getActiveWindow(): Promise<WindowInfo | null>;
/**
 * 根据进程名获取窗口信息
 * 如果窗口最小化，会先激活再获取坐标
 */
export declare function getWindowByProcess(processName: string): Promise<WindowInfo | null>;
/**
 * 列出所有窗口（包括最小化的）
 * 使用 ps-list 获取所有 GUI 进程，结合 get-windows 和 AppleScript
 */
export declare function listWindows(): Promise<WindowInfo[]>;
/**
 * 列出所有 GUI 进程（包括没有窗口的）
 */
export declare function listProcesses(): Promise<ProcessInfo[]>;
export {};
//# sourceMappingURL=window-manager.d.ts.map