import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function runPS(script) {
    const tmpFile = join(tmpdir(), "nmg_mcp_" + Date.now() + ".ps1");
    writeFileSync(tmpFile, script, "utf8");
    try {
        return execSync("powershell -NoProfile -File \"" + tmpFile + "\"", { encoding: "utf8", timeout: 15000 });
    } finally {
        try { unlinkSync(tmpFile); } catch(e) {}
    }
}

export async function uiInspect(processName) {
    const lines = [
        "Add-Type -AssemblyName UIAutomationClient",
        "$ErrorActionPreference = SilentlyContinue",
        "$proc = Get-Process -Name " + processName + " -ErrorAction SilentlyContinue",
        "if (-not $proc) { Write-Output []; exit }",
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)",
        "$all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)",
        "$results = @()",
        "foreach ($el in $all) {",
        "  try {",
        "    $type = $el.Current.ControlType.ProgrammaticName",
        "    $id = $el.Current.AutomationId",
        "    $name = $el.Current.Name",
        "    $r = $el.Current.BoundingRectangle",
        "    $w = 0; $h = 0",
        "    if ($r.Width -gt 0) { $w = [int]$r.Width }",
        "    if ($r.Height -gt 0) { $h = [int]$r.Height }",
        "    if ($id -or $name) {",
        "      $results += @{ type = $type; id = $id; name = $name; w = $w; h = $h }",
        "    }",
        "  } catch {}",
        "}",
        "$results | ConvertTo-Json -Compress -Depth 3"
    ];
    const script = lines.join(String.fromCharCode(10));
    return JSON.parse(runPS(script));
}

export async function uiGetElement(processName, automationId) {
    const lines = [
        "Add-Type -AssemblyName UIAutomationClient",
        "$ErrorActionPreference = SilentlyContinue",
        "$proc = Get-Process -Name " + processName + " -ErrorAction SilentlyContinue",
        "if (-not $proc) { Write-Output {}; exit }",
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)",
        "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, " + automationId + ")",
        "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)",
        "if (-not $el) { Write-Output {}; exit }",
        "$r = $el.Current.BoundingRectangle",
        "@{ type = $el.Current.ControlType.ProgrammaticName; id = $el.Current.AutomationId; name = $el.Current.Name; w = [int]$r.Width; h = [int]$r.Height } | ConvertTo-Json -Compress"
    ];
    const script = lines.join(String.fromCharCode(10));
    return JSON.parse(runPS(script));
}

export async function uiSetText(processName, automationId, text) {
    const lines = [
        "Add-Type -AssemblyName UIAutomationClient",
        "$proc = Get-Process -Name " + processName + " -ErrorAction SilentlyContinue",
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)",
        "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, " + automationId + ")",
        "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)",
        "if (-not $el) { return }",
        "$vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)",
        "$vp.SetValue(" + JSON.stringify(text) + ")",
        "Write-Output success"
    ];
    const script = lines.join(String.fromCharCode(10));
    try { runPS(script); return { success: true }; } catch(e) { return { success: false }; }
}

export async function uiInvoke(processName, automationId) {
    const lines = [
        "Add-Type -AssemblyName UIAutomationClient",
        "$proc = Get-Process -Name " + processName + " -ErrorAction SilentlyContinue",
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)",
        "$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, " + automationId + ")",
        "$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)",
        "if (-not $el) { return }",
        "$ip = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)",
        "$ip.Invoke()",
        "Write-Output success"
    ];
    const script = lines.join(String.fromCharCode(10));
    try { runPS(script); return { success: true }; } catch(e) { return { success: false }; }
}