/**
 * Desktop Automation MCP Types
 */
export interface WindowInfo {
    title: string;
    owner: {
        name: string;
        processId: number;
        bundleId?: string;
        path?: string;
    };
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface DisplayInfo {
    id: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleFactor: number;
    isPrimary: boolean;
}
export interface ScreenshotOutput {
    base64: string;
    width: number;
    height: number;
    scaleFactor: number;
    windowBounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface BBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
export interface ScreenCoords {
    x: number;
    y: number;
}
export interface CoordConvertParams {
    bbox: BBox;
    windowBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    scaleFactor?: number;
}
export type MouseButton = 'left' | 'right' | 'middle';
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';
export interface OperationResult {
    success: boolean;
    message?: string;
    data?: unknown;
}
//# sourceMappingURL=types.d.ts.map