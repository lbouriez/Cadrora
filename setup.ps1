#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('en', 'fr')][string]$Language = 'en',
    [switch]$Diagnose,
    [switch]$Preview,
    [switch]$EditAnswers,
    [switch]$ReplaceToken,
    [switch]$Local
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'scripts/setup/windows.ps1')
try {
    Invoke-CadroraSetup -Root $PSScriptRoot -Language $Language -Diagnose:$Diagnose -Preview:$Preview -UseSavedLanguage:(-not $PSBoundParameters.ContainsKey('Language')) -EditAnswers:$EditAnswers -ReplaceToken:$ReplaceToken -Local:$Local
} catch {
    Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + $_.Exception.Message) -Accent Yellow
    exit 1
}
