// Pixel color analysis tools for UI debugging
// Uses node-screenshots for capture and pure JS for analysis
import { execSync } from 'child_process';

/**
 * Analyze pixel colors in a window region
 * Detects white backgrounds, low contrast, and color distribution
 */
export async function pixelAnalyze(processName, region) {
    // Take screenshot via PowerShell
    const psScript = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CapHelper {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$proc = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue
if (-not $proc) { Write-Output '{"error":"process not found"}'; exit }
$rect = New-Object CapHelper+RECT
[CapHelper]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
$g.Dispose()

$white = 0; $total = 0; $dark = 0
$samples = @()
for ($y = 55; $y -lt $h - 5; $y += 3) {
    for ($x = 5; $x -lt $w - 5; $x += 3) {
        $px = $bmp.GetPixel($x, $y)
        $total++
        if ($px.R -gt 240 -and $px.G -gt 240 -and $px.B -gt 240) { $white++ }
        if ($px.R -lt 60 -and $px.G -lt 60 -and $px.B -lt 60) { $dark++ }
    }
}

# Sample specific rows
foreach ($yPct in @(0.25, 0.50, 0.75)) {
    $sy = [int]($h * $yPct)
    $rowSamples = @()
    for ($x = 50; $x -lt $w - 50; $x += [int]($w / 8)) {
        $px = $bmp.GetPixel($x, $sy)
        $rowSamples += "$($px.R),$($px.G),$($px.B)"
    }
    $samples += @{ yPercent = $yPct; y = $sy; colors = $rowSamples }
}

$bmp.Dispose()
@{
    whitePercent = [Math]::Round($white / $total * 100, 2)
    darkPercent = [Math]::Round($dark / $total * 100, 2)
    totalSampled = $total
    windowWidth = $w; windowHeight = $h
    rowSamples = $samples
} | ConvertTo-Json -Compress -Depth 3
`;
    try {
        const output = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            { encoding: 'utf8', timeout: 30000 });
        return JSON.parse(output);
    } catch (e) {
        throw new Error(`Pixel analyze failed: ${e.message}`);
    }
}

/**
 * Check contrast ratio between two colors (WCAG)
 */
export function contrastRatio(rgb1, rgb2) {
    const lum = (rgb) => {
        const [r, g, b] = rgb.split(',').map(Number);
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    const l1 = lum(rgb1);
    const l2 = lum(rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Math.round((lighter + 0.05) / (darker + 0.05) * 100) / 100;
}
