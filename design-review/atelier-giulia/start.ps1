param([ValidateRange(1024, 65535)][int]$Port = 4180)

$ErrorActionPreference = 'Stop'
$reviewUrl = "http://127.0.0.1:$Port/"
$existingReview = $null
try {
    $existingReview = Invoke-WebRequest -Uri $reviewUrl -TimeoutSec 2
} catch {
    # No running preview is the normal first-launch state.
}

if ($existingReview -and $existingReview.Content.Contains('Atelier Giulia — Design review')) {
    Write-Host "Atelier Giulia design review is already running: $reviewUrl"
    exit 0
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $Port belongs to another server. Run this script with -Port followed by an unused port."
}

Write-Host "Atelier Giulia design review: $reviewUrl"
Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
& python -u -m http.server $Port --bind 127.0.0.1 --directory $PSScriptRoot
exit $LASTEXITCODE
