/**
 * Window Manager - 窗口管理模块
 * 支持 macOS 和 Windows
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import { isMacOS, isWindows, sleep } from './utils.js';
import { activeWindow, openWindows } from 'get-windows';
import psList from 'ps-list';
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// scripts 目录在 src/scripts，编译后 dist 和 src 同级
const scriptsDir = path.join(__dirname, '..', 'src', 'scripts');
// get-windows 配置
const getWindowsOptions = { accessibilityPermission: false, screenRecordingPermission: true };
/**
 * App name alias groups — maps equivalent names across languages/conventions.
 * All entries MUST be lowercase. Each group is a set of names that refer to the same app.
 */
const APP_NAME_ALIASES = [
    ['lark', 'feishu', '飞书'],
    ['wechat', 'weixin', '微信'],
    ['dingtalk', '钉钉'],
    ['企业微信', 'wxwork', 'wecom'],
    ['腾讯会议', 'wemeet', 'tencent meeting'],
    ['google chrome', 'chrome'],
    ['visual studio code', 'code', 'vscode'],
    ['cursor'],
    ['microsoft edge', 'edge', 'msedge'],
    ['firefox', 'mozilla firefox'],
    ['sublime text', 'sublime'],
    ['iterm2', 'iterm'],
    ['telegram', 'telegram desktop'],
    ['docker desktop', 'docker'],
    ['activity monitor', '活动监视器'],
    ['finder', '访达'],
    ['system preferences', 'system settings', '系统偏好设置', '系统设置'],
    ['terminal', '终端'],
    ['notes', '备忘录'],
    ['messages', '信息'],
    ['mail', '邮件'],
    ['calendar', '日历'],
    ['preview', '预览'],
    ['textedit', '文本编辑', 'texteditor'],
    ['music', '音乐'],
    ['qq音乐', 'qqmusic'],
    ['网易云音乐', 'neteasemusic', 'cloudmusic'],
    ['qq', 'tencentqq'],
    ['safari'],
    ['notion'],
    ['obsidian'],
    ['figma'],
    ['postman'],
    ['slack'],
    ['discord'],
    ['spotify'],
];
/**
 * macOS: 进程名/别名 -> 用于 "tell application X to activate" 的应用名（AppleScript 需精确名称）
 * 先尝试「应用激活」再回退到 System Events，Chrome 等用应用激活更稳定
 */
const PROCESS_TO_APP_NAME_MAC = {
    'google chrome': 'Google Chrome',
    chrome: 'Google Chrome',
    'visual studio code': 'Visual Studio Code',
    code: 'Visual Studio Code',
    vscode: 'Visual Studio Code',
    cursor: 'Cursor',
    'microsoft edge': 'Microsoft Edge',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    safari: 'Safari',
    firefox: 'Firefox',
    'mozilla firefox': 'Firefox',
    terminal: 'Terminal',
    终端: 'Terminal',
    iterm2: 'iTerm',
    iterm: 'iTerm',
    finder: 'Finder',
    访达: 'Finder',
    lark: 'Lark',
    feishu: 'Lark',
    飞书: 'Lark',
    wechat: 'WeChat',
    weixin: 'WeChat',
    微信: 'WeChat',
    dingtalk: 'DingTalk',
    钉钉: 'DingTalk',
    notion: 'Notion',
    slack: 'Slack',
    discord: 'Discord',
    spotify: 'Spotify',
    mail: 'Mail',
    calendar: 'Calendar',
    notes: 'Notes',
    preview: 'Preview',
    'activity monitor': 'Activity Monitor',
    活动监视器: 'Activity Monitor',
};
/**
 * Get all known alias names for a given process name.
 * Returns the alias group if found, otherwise returns [processName] itself.
 */
export function getProcessNameAliases(processName) {
    const lower = processName.toLowerCase().trim();
    if (lower.length < 2)
        return [lower];
    for (const group of APP_NAME_ALIASES) {
        if (group.some(name => name === lower || name.includes(lower) || lower.includes(name))) {
            return group;
        }
    }
    return [lower];
}
/**
 * Check if a window matches the given process name.
 * Supports substring matching (existing) + alias-based matching (new).
 */
export function matchesProcessName(ownerName, windowTitle, processName) {
    const ownerLower = ownerName.toLowerCase();
    const titleLower = windowTitle.toLowerCase();
    const processNameLower = processName.toLowerCase();
    if (ownerLower.includes(processNameLower) ||
        processNameLower.includes(ownerLower) ||
        titleLower.includes(processNameLower)) {
        return true;
    }
    const aliases = getProcessNameAliases(processName);
    return aliases.some(alias => {
        if (alias === processNameLower)
            return false;
        return ownerLower.includes(alias) ||
            alias.includes(ownerLower) ||
            titleLower.includes(alias);
    });
}
/**
 * 根据进程名激活窗口（置顶）
 * @param processName 进程名称
 * @param title 窗口标题（可选，用于更精确匹配）
 */
export async function activateWindow(processName, title) {
    try {
        if (isMacOS()) {
            const namesToTry = getProcessNameAliases(processName);
            if (!namesToTry.includes(processName.toLowerCase())) {
                namesToTry.unshift(processName);
            }
            // macOS: 先尝试「tell application X to activate」，Chrome 等用此方式更稳定
            const appName = PROCESS_TO_APP_NAME_MAC[processName.toLowerCase().trim()] ??
                namesToTry.map(n => PROCESS_TO_APP_NAME_MAC[n]).find(Boolean);
            if (appName) {
                try {
                    const activateScript = `tell application "${appName.replace(/"/g, '""')}" to activate`;
                    await execAsync(`osascript -e '${activateScript.replace(/'/g, "'\"'\"'")}'`);
                    return true;
                }
                catch (_e) {
                    // 应用未安装或未运行，继续用 System Events
                }
            }
            for (const tryName of namesToTry) {
                try {
                    const safeName = tryName.replace(/"/g, '""');
                    const script = `
            tell application "System Events"
              tell process "${safeName}"
                set frontmost to true
                if (count of windows) > 0 then
                  perform action "AXRaise" of window 1
                end if
              end tell
            end tell
          `;
                    await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
                    return true;
                }
                catch (e) {
                    continue;
                }
            }
            return false;
        }
        else if (isWindows()) {
            // Windows: 使用 PowerShell 脚本
            const scriptPath = path.join(scriptsDir, 'activate-window.ps1');
            const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}" -ProcessName "${processName}"`, { encoding: 'utf8' });
            return stdout.trim() === 'OK';
        }
        return false;
    }
    catch (error) {
        console.error('Failed to activate window:', error);
        return false;
    }
}
/**
 * 获取当前活动窗口信息
 */
export async function getActiveWindow() {
    try {
        // 优先使用 get-windows（跨平台）
        const win = await activeWindow(getWindowsOptions);
        if (win) {
            return {
                title: win.title,
                owner: {
                    name: win.owner.name,
                    processId: win.owner.processId
                },
                bounds: {
                    x: win.bounds.x,
                    y: win.bounds.y,
                    width: win.bounds.width,
                    height: win.bounds.height
                }
            };
        }
    }
    catch (e) {
        console.error('[getActiveWindow] get-windows 失败，尝试备用方法:', e);
    }
    // 备用方法
    const SEP = ':::SEP:::';
    try {
        if (isMacOS()) {
            const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
          set appId to unix id of frontApp
          tell frontApp
            set winCount to count of windows
            if winCount > 0 then
              try
                set frontWin to (first window whose value of attribute "AXMain" is true)
              on error
                set frontWin to first window
              end try
              set winTitle to name of frontWin
              set winPos to position of frontWin
              set winSize to size of frontWin
              return appName & ":::SEP:::" & appId & ":::SEP:::" & winTitle & ":::SEP:::" & (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize) & ":::SEP:::" & winCount
            else
              return appName & ":::SEP:::" & appId & ":::SEP:::" & ":::SEP:::" & "0,0,800,600" & ":::SEP:::" & "0"
            end if
          end tell
        end tell
      `;
            const { stdout } = await execAsync(`osascript -e '${script}'`);
            const parts = stdout.trim().split(SEP);
            if (parts.length >= 4) {
                const bounds = parts[3].split(',').map(n => parseInt(n.trim()));
                return {
                    title: parts[2],
                    owner: {
                        name: parts[0],
                        processId: parseInt(parts[1])
                    },
                    bounds: {
                        x: bounds[0] || 0,
                        y: bounds[1] || 0,
                        width: bounds[2] || 800,
                        height: bounds[3] || 600
                    }
                };
            }
        }
        else if (isWindows()) {
            const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class Win32Active {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
            [DllImport("user32.dll")]
            public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
            [StructLayout(LayoutKind.Sequential)]
            public struct RECT { public int Left, Top, Right, Bottom; }
          }
"@
        $hwnd = [Win32Active]::GetForegroundWindow()
        $title = New-Object System.Text.StringBuilder 256
        [Win32Active]::GetWindowText($hwnd, $title, 256)
        $processId = 0
        [Win32Active]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        $process = Get-Process -Id $processId
        $rect = New-Object Win32Active+RECT
        [Win32Active]::GetWindowRect($hwnd, [ref]$rect)
        Write-Output "$($process.ProcessName)|$processId|$($title.ToString())|$($rect.Left),$($rect.Top),$($rect.Right - $rect.Left),$($rect.Bottom - $rect.Top)"
      `;
            const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { shell: 'powershell.exe' });
            const parts = stdout.trim().split('|');
            if (parts.length >= 4) {
                const bounds = parts[3].split(',').map(n => parseInt(n.trim()));
                return {
                    title: parts[2],
                    owner: {
                        name: parts[0],
                        processId: parseInt(parts[1])
                    },
                    bounds: {
                        x: bounds[0] || 0,
                        y: bounds[1] || 0,
                        width: bounds[2] || 800,
                        height: bounds[3] || 600
                    }
                };
            }
        }
        return null;
    }
    catch (error) {
        console.error('Failed to get active window:', error);
        return null;
    }
}
/**
 * 根据进程名获取窗口信息
 * 如果窗口最小化，会先激活再获取坐标
 */
export async function getWindowByProcess(processName) {
    // 先尝试直接获取
    try {
        const windows = await openWindows(getWindowsOptions);
        const targetWindow = windows.find(w => matchesProcessName(w.owner.name, w.title, processName));
        if (targetWindow) {
            return {
                title: targetWindow.title,
                owner: {
                    name: targetWindow.owner.name,
                    processId: targetWindow.owner.processId
                },
                bounds: {
                    x: targetWindow.bounds.x,
                    y: targetWindow.bounds.y,
                    width: targetWindow.bounds.width,
                    height: targetWindow.bounds.height
                }
            };
        }
    }
    catch (e) {
        console.error('[getWindowByProcess] get-windows 失败:', e);
    }
    // Windows: 使用 PowerShell 脚本作为备用方法
    if (isWindows()) {
        try {
            const scriptPath = path.join(scriptsDir, 'get-window-by-process.ps1');
            const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}" -ProcessName "${processName}"`, { encoding: 'utf8' });
            const output = stdout.trim();
            if (output !== 'NOT_FOUND') {
                const parts = output.split('|');
                if (parts.length >= 7) {
                    return {
                        title: parts[2] || parts[0],
                        owner: {
                            name: parts[0],
                            processId: parseInt(parts[1])
                        },
                        bounds: {
                            x: parseInt(parts[3]) || 0,
                            y: parseInt(parts[4]) || 0,
                            width: parseInt(parts[5]) || 0,
                            height: parseInt(parts[6]) || 0
                        }
                    };
                }
            }
        }
        catch (e) {
            console.error('[getWindowByProcess] PowerShell 备用方法失败:', e);
        }
    }
    // 窗口可能最小化，先激活再获取
    console.error(`[getWindowByProcess] 窗口可能最小化，尝试激活: ${processName}`);
    const activated = await activateWindow(processName);
    if (!activated) {
        console.error(`[getWindowByProcess] 激活失败: ${processName}`);
        return null;
    }
    // 等待窗口激活
    await sleep(300);
    // 再次尝试获取
    try {
        const windows = await openWindows(getWindowsOptions);
        const targetWindow = windows.find(w => matchesProcessName(w.owner.name, w.title, processName));
        if (targetWindow) {
            return {
                title: targetWindow.title,
                owner: {
                    name: targetWindow.owner.name,
                    processId: targetWindow.owner.processId
                },
                bounds: {
                    x: targetWindow.bounds.x,
                    y: targetWindow.bounds.y,
                    width: targetWindow.bounds.width,
                    height: targetWindow.bounds.height
                }
            };
        }
    }
    catch (e) {
        console.error('[getWindowByProcess] 激活后获取失败:', e);
    }
    // 最后用 AppleScript 备用方法，尝试所有别名
    if (isMacOS()) {
        const namesToTry = getProcessNameAliases(processName);
        if (!namesToTry.includes(processName.toLowerCase())) {
            namesToTry.unshift(processName);
        }
        for (const tryName of namesToTry) {
            try {
                const script = `
          tell application "System Events"
            tell process "${tryName}"
              set procId to unix id
              if (count of windows) > 0 then
                set frontWin to first window
                set winTitle to name of frontWin
                set winPos to position of frontWin
                set winSize to size of frontWin
                return winTitle & ":::SEP:::" & procId & ":::SEP:::" & (item 1 of winPos) & "," & (item 2 of winPos) & "," & (item 1 of winSize) & "," & (item 2 of winSize)
              end if
            end tell
          end tell
        `;
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                const parts = stdout.trim().split(':::SEP:::');
                if (parts.length >= 3) {
                    const bounds = parts[2].split(',').map(n => parseInt(n.trim()));
                    return {
                        title: parts[0],
                        owner: {
                            name: tryName,
                            processId: parseInt(parts[1]) || 0
                        },
                        bounds: {
                            x: bounds[0] || 0,
                            y: bounds[1] || 0,
                            width: bounds[2] || 800,
                            height: bounds[3] || 600
                        }
                    };
                }
            }
            catch (e) {
                continue;
            }
        }
        console.error(`[getWindowByProcess] AppleScript 备用方法全部失败, tried: ${namesToTry.join(', ')}`);
    }
    return null;
}
/**
 * 列出所有窗口（包括最小化的）
 * 使用 ps-list 获取所有 GUI 进程，结合 get-windows 和 AppleScript
 */
export async function listWindows() {
    const windows = [];
    const addedPids = new Set();
    // Windows: 只使用 PowerShell 脚本（get-windows 在 Windows 上可能卡住）
    if (isWindows()) {
        try {
            const scriptPath = path.join(scriptsDir, 'list-windows.ps1');
            const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}"`, { encoding: 'utf8', timeout: 10000 });
            const lines = stdout.trim().split('\n').filter(Boolean);
            for (const line of lines) {
                const parts = line.trim().split('|');
                if (parts.length >= 7) {
                    const pid = parseInt(parts[1]);
                    if (addedPids.has(pid))
                        continue;
                    windows.push({
                        title: parts[2] || parts[0],
                        owner: {
                            name: parts[0],
                            processId: pid
                        },
                        bounds: {
                            x: parseInt(parts[3]) || 0,
                            y: parseInt(parts[4]) || 0,
                            width: parseInt(parts[5]) || 0,
                            height: parseInt(parts[6]) || 0
                        }
                    });
                    addedPids.add(pid);
                }
            }
        }
        catch (e) {
            console.error('[listWindows] Windows PowerShell 获取失败:', e);
        }
        return windows;
    }
    // macOS: 使用 get-windows + AppleScript 补充
    // 1. 先用 get-windows 获取已打开的窗口
    try {
        const openWins = await openWindows(getWindowsOptions);
        for (const w of openWins) {
            windows.push({
                title: w.title,
                owner: {
                    name: w.owner.name,
                    processId: w.owner.processId
                },
                bounds: {
                    x: w.bounds.x,
                    y: w.bounds.y,
                    width: w.bounds.width,
                    height: w.bounds.height
                }
            });
            addedPids.add(w.owner.processId);
        }
    }
    catch (e) {
        console.error('[listWindows] get-windows 失败:', e);
    }
    // 2. macOS: 用 ps-list 获取所有进程，找出可能有窗口但未被 get-windows 列出的
    if (isMacOS()) {
        try {
            // 获取所有非后台进程名
            const { stdout: procList } = await execAsync(`osascript -e 'tell application "System Events" to get name of every process whose background only is false'`);
            const guiProcessNames = procList.trim().split(', ').filter(Boolean);
            // 获取所有进程的 PID
            const processes = await psList();
            const processMap = new Map();
            for (const proc of processes) {
                const name = proc.name;
                if (!processMap.has(name)) {
                    processMap.set(name, []);
                }
                processMap.get(name).push({ name, pid: proc.pid, ppid: proc.ppid });
            }
            // 检查每个 GUI 进程是否已在窗口列表中
            for (const procName of guiProcessNames) {
                const procs = processMap.get(procName);
                if (!procs || procs.length === 0)
                    continue;
                // 检查是否已添加
                const alreadyAdded = procs.some(p => addedPids.has(p.pid));
                if (alreadyAdded)
                    continue;
                // 尝试获取窗口信息（可能是最小化的）
                try {
                    const script = `
            tell application "System Events"
              tell process "${procName}"
                set procId to unix id
                set winCount to count of windows
                if winCount > 0 then
                  set frontWin to first window
                  set winTitle to name of frontWin
                  return winTitle & ":::SEP:::" & procId & ":::SEP:::" & winCount
                else
                  return ":::SEP:::" & procId & ":::SEP:::0"
                end if
              end tell
            end tell
          `;
                    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
                    const parts = stdout.trim().split(':::SEP:::');
                    if (parts.length >= 3) {
                        const winCount = parseInt(parts[2]) || 0;
                        const pid = parseInt(parts[1]) || procs[0].pid;
                        if (winCount > 0) {
                            // 有窗口但可能最小化，标记为需要激活
                            windows.push({
                                title: parts[0] || procName,
                                owner: {
                                    name: procName,
                                    processId: pid
                                },
                                bounds: { x: 0, y: 0, width: 0, height: 0 }, // 最小化窗口无法获取坐标
                            });
                            addedPids.add(pid);
                        }
                    }
                }
                catch (e) {
                    // 忽略单个进程的错误
                }
            }
        }
        catch (e) {
            console.error('[listWindows] ps-list 补充失败:', e);
        }
    }
    return windows;
}
/**
 * 列出所有 GUI 进程（包括没有窗口的）
 */
export async function listProcesses() {
    if (isMacOS()) {
        try {
            const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get {name, unix id} of every process whose background only is false'`);
            // 解析输出格式: {{name1, name2}, {pid1, pid2}}
            const match = stdout.match(/\{\{(.+)\}, \{(.+)\}\}/);
            if (match) {
                const names = match[1].split(', ');
                const pids = match[2].split(', ').map(p => parseInt(p));
                return names.map((name, i) => ({ name, pid: pids[i] }));
            }
        }
        catch (e) {
            console.error('[listProcesses] 失败:', e);
        }
    }
    // 通用方法
    const processes = await psList();
    return processes.map(p => ({ name: p.name, pid: p.pid, ppid: p.ppid }));
}
//# sourceMappingURL=window-manager.js.map