$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot)
. (Join-Path $root 'scripts/setup/windows.ps1')
$script:SetupText = Get-Content (Join-Path $root 'scripts/setup/messages.fr.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$script:captured = @()
function Write-SetupText { param($Text, $Color) $script:captured += $Text }
function Write-SetupNotice { param($Text, $Kind) $script:captured += $Text }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('cadrora-logging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $script:SetupSession = @{ Path = Join-Path $temporary 'progress.json' }
    $child = Join-Path $temporary 'child with spaces.cjs'
    [IO.File]::WriteAllText($child, "console.log('private technical output'); console.error('stderr detail'); process.exitCode = Number(process.argv[2]);")
    Invoke-SetupCommand $env:CADRORA_TEST_NODE @($child, '0')
    if (($script:captured -join "`n") -match 'private technical output|stderr detail') { throw 'Technical output reached the console.' }
    if (-not (($script:captured -join "`n").Contains($script:SetupText.commandComplete))) { throw 'Success notice missing.' }
    foreach ($code in @(42, -4082, -4048)) {
        $caught = $false
        try { Invoke-SetupCommand $env:CADRORA_TEST_NODE @($child, [string]$code) }
        catch { $caught = $true; if ($_.Exception.Data['ExitCode'] -ne $code) { throw 'Native failure code was lost.' } }
        if (-not $caught) { throw 'Command failure was swallowed.' }
    }
    $logs = @(Get-ChildItem -LiteralPath (Join-Path $temporary 'logs') -Filter '*.log')
    if ($logs.Count -ne 4) { throw 'Expected separate attempt logs.' }
    foreach ($log in $logs) {
        $content = Get-Content -LiteralPath $log.FullName -Raw -Encoding UTF8
        if (-not $content.Contains('stderr detail') -or -not $content.Contains('private technical output')) { throw 'Incomplete log.' }
    }
    # Exercise the npm.cmd shim using the installed CLI without installing anything.
    $npm = Join-Path (Split-Path $env:CADRORA_TEST_NODE) 'npm.cmd'
    Invoke-SetupCommand $npm @('--version')
    Write-Output 'Windows setup logging checks passed'
} finally {
    $resolved = [IO.Path]::GetFullPath($temporary)
    if (-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
