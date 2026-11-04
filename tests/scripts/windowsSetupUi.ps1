# Presentation checks run without files, browser calls or deployment commands.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path (Split-Path $PSScriptRoot)
. (Join-Path $root 'scripts/setup/windows.ps1')
$script:lines = New-Object 'System.Collections.Generic.List[string]'
$script:colors = New-Object 'System.Collections.Generic.List[string]'
$script:answers = New-Object 'System.Collections.Generic.Queue[string]'
function Assert-Ui([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Write-Host {
    param([object]$Object = '', [string]$ForegroundColor)
    $script:lines.Add([string]$Object)
    $script:colors.Add($ForegroundColor)
}
function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    if (-not $script:answers.Count) { throw 'Preview asked for input.' }
    $answer = $script:answers.Dequeue()
    if ($AsSecureString) { return ConvertTo-SecureString $answer -AsPlainText -Force }
    return $answer
}
function Find-SetupNode { throw 'Preview inspected tools.' }
function Open-SetupPage { throw 'Preview opened a browser.' }
function Invoke-SetupCommand { throw 'Preview ran a command.' }
function Start-SetupSession { throw 'Preview wrote saved state.' }
function Get-SetupConsoleWidth { return $script:width }

foreach ($language in @('fr', 'en')) {
    foreach ($script:width in @(52, 88)) {
        $script:lines.Clear(); $script:colors.Clear()
        Invoke-CadroraSetup -Root $root -Language $language -Preview
        Assert-Ui ($script:lines.Count -gt 50) 'Preview omitted the main screens.'
        Assert-Ui (@($script:lines | Where-Object { $_.Length -gt $script:width }).Count -eq 0) 'Preview overflowed the terminal width.'
        Assert-Ui ($script:colors.Contains('Cyan') -and $script:colors.Contains('Yellow') -and $script:colors.Contains('Green')) 'Status hierarchy is not rendered.'
        Assert-Ui (($script:lines -join "`n").Contains('[' + (Get-SetupText 'githubPublishDefault') + ']')) 'Deployment default is hidden.'
        Assert-Ui (($script:lines -join "`n").Contains('[1]')) 'Menu default is hidden.'
    }
    # Defaults resolve to real actions, and STOP still prevents deployment.
    $script:answers.Enqueue('')
    Assert-Ui ((Read-SetupValue 'confirm' '^(DEPLOY|STOP)$' 'DEPLOY') -eq 'DEPLOY') 'Enter did not choose DEPLOY.'
    $script:answers.Enqueue('stop')
    Assert-Ui ((Read-SetupValue 'confirm' '^(DEPLOY|STOP)$' 'DEPLOY') -eq 'STOP') 'STOP did not override the default.'
    $script:answers.Enqueue((Get-SetupText 'continueDefault'))
    Assert-Ui ((Read-SetupPrompt (Get-SetupText 'stepAction') -Default 'done' -DefaultLabel (Get-SetupText 'continueDefault')) -eq 'done') 'Typing the visible default did not choose that action.'
    $script:lines.Clear()
    $script:answers.Enqueue('private-value-not-for-display')
    $secret = Read-SetupPrompt (Get-SetupText 'token') -AsSecureString
    try {
        Assert-Ui ($secret -is [Security.SecureString]) 'Private prompt stopped masking input.'
        Assert-Ui (($script:lines -join "`n") -notmatch 'private-value-not-for-display|\[DEPLOY\]') 'Private input or a secret default was displayed.'
    } finally { $secret.Dispose() }
}
Microsoft.PowerShell.Utility\Write-Output 'Windows setup UI checks passed'
