# Shared console presentation. ASCII framing works in Windows PowerShell 5.1.
# All application copy comes from messages.en/fr.json; never pass secret values.
function Get-SetupConsoleWidth {
    $width = 80
    try { if ($Host.UI.RawUI.WindowSize.Width -gt 0) { $width = $Host.UI.RawUI.WindowSize.Width } } catch { }
    return [Math]::Max(24, [Math]::Min(88, $width - 2))
}

function Split-SetupLines {
    param([string]$Text, [int]$Width)
    foreach ($paragraph in ($Text -split '\r?\n')) {
        $remaining = $paragraph.TrimEnd()
        if (-not $remaining) { ''; continue }
        $continuation = if ($remaining -match '^\s*\d+\.') { '   ' } else { '' }
        while ($remaining.Length -gt $Width) {
            $cut = $remaining.LastIndexOf(' ', $Width)
            if ($cut -le 0) { $cut = $Width }
            $remaining.Substring(0, $cut).TrimEnd()
            $remaining = $continuation + $remaining.Substring($cut).TrimStart()
        }
        $remaining
    }
}

function Write-SetupText {
    param([string]$Text, [ConsoleColor]$Color = 'Gray')
    foreach ($line in @(Split-SetupLines $Text ((Get-SetupConsoleWidth) - 2))) {
        Write-Host ("  " + $line) -ForegroundColor $Color
    }
}

function Write-SetupBlock {
    param([string]$Text, [ConsoleColor]$Accent = 'Cyan')
    $width = (Get-SetupConsoleWidth) - 4
    $parts = $Text.Trim() -split '\r?\n', 2
    $edge = '+' + ('-' * ($width + 2)) + '+'
    Write-Host ''
    Write-Host $edge -ForegroundColor $Accent
    foreach ($line in @(Split-SetupLines $parts[0] $width)) {
        Write-Host ('| ' + $line.PadRight($width) + ' |') -ForegroundColor $Accent
    }
    if ($parts.Count -gt 1 -and $parts[1].Trim()) {
        Write-Host $edge -ForegroundColor DarkGray
        foreach ($line in @(Split-SetupLines $parts[1].Trim() $width)) {
            Write-Host ('| ' + $line.PadRight($width) + ' |') -ForegroundColor Gray
        }
    }
    Write-Host $edge -ForegroundColor $Accent
    Write-Host ''
}

function Write-SetupNotice {
    param([string]$Text, [ValidateSet('Info', 'Success', 'Warning')][string]$Kind = 'Info')
    $marker = switch ($Kind) { 'Success' { '[OK]' } 'Warning' { '[!]' } default { '...' } }
    $color = switch ($Kind) { 'Success' { 'Green' } 'Warning' { 'Yellow' } default { 'Gray' } }
    Write-SetupText "$marker $Text" -Color $color
}

function Write-SetupQuestion {
    param([string]$Text, [string]$DefaultLabel = '')
    Write-Host ''
    Write-SetupText $Text -Color White
    if ($DefaultLabel) { Write-SetupText ((Get-SetupText 'defaultHint') -f $DefaultLabel) -Color Cyan }
}

function Read-SetupPrompt {
    param([string]$Text, [string]$Default = '', [string]$DefaultLabel = '', [switch]$AsSecureString)
    if (-not $DefaultLabel) { $DefaultLabel = $Default }
    Write-SetupQuestion $Text $DefaultLabel
    if ($AsSecureString) { return Read-Host '  >' -AsSecureString }
    $value = (Read-Host '  >').Trim()
    if (-not $value -or ($Default -and $value -ieq $DefaultLabel)) { return $Default }
    return $value
}

function Show-SetupPreview {
    Write-SetupBlock ((Get-SetupText 'previewTitle') + "`n" + (Get-SetupText 'previewHelp'))
    Write-SetupBlock (Get-SetupText 'githubTools')
    Write-SetupBlock ((Get-SetupText 'githubRepositoryReady') -f 'photographe/Cadrora', 'main')
    Write-SetupBlock (Get-SetupText 'profileChoose')
    Write-SetupQuestion (Get-SetupText 'recoveryChoice') '1'
    Write-SetupBlock (Get-SetupText 'accountStep')
    Write-SetupQuestion (Get-SetupText 'account')
    Write-SetupBlock ((Get-SetupText 'turnstileStep') -f 'photos.exemple.fr', 'mon-studio')
    Write-SetupQuestion (Get-SetupText 'stepAction') (Get-SetupText 'continueDefault')
    Write-SetupNotice (Get-SetupText 'verified') 'Success'
    Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + (Get-SetupText 'tokenRejected')) -Accent Yellow
    Write-SetupBlock (Get-SetupText 'tokenRecoveryAction')
    Write-SetupQuestion (Get-SetupText 'recoveryChoice') '1'
    Write-SetupBlock ((Get-SetupText 'githubSummary') -f 'photographe/Cadrora', 'main', 'mon-studio', 'photos.exemple.fr', 'mon-studio-production')
    Write-SetupQuestion (Get-SetupText 'githubConfirm') (Get-SetupText 'githubPublishDefault')
}
