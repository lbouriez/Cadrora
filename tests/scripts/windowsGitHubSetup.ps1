$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path (Split-Path $PSScriptRoot)
. (Join-Path $root 'scripts/setup/windows.ps1')
$script:SetupText = Get-Content (Join-Path $root 'scripts/setup/messages.fr.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('cadrora-gh-wizard-' + [guid]::NewGuid().ToString('N'))
$directory = Join-Path $temporary '.artifacts/instances/my-studio'
$script:answers = New-Object 'System.Collections.Generic.Queue[string]'
$script:calls = New-Object 'System.Collections.Generic.List[string]'
$script:screen = New-Object 'System.Collections.Generic.List[string]'
$script:siteReady = $false
$script:loginReady = $false
$script:keysChanged = $false
$script:runAttempt = 1
$script:deploymentProof = 'deployment|domain'
function Assert-Test([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Write-Host { param($Object, $ForegroundColor) $script:screen.Add([string]$Object) }
function Read-Host { param($Prompt) if (-not $script:answers.Count) { throw "Unexpected prompt: $Prompt" }; return $script:answers.Dequeue() }
function Confirm-SetupGitHubTools { param($Node) return $true }
function Invoke-SetupCommand { param($Command, $Arguments) $script:calls.Add('native:' + ($Arguments -join ' ')) }
function Invoke-SetupGitHubHelper {
    param($Root, $Node, $Action, $Request)
    $script:calls.Add($Action)
    switch ($Action) {
        'inspect' { return @{ repository = 'owner/Cadrora'; branch = 'main'; profiles = @(@{ id = 'studio'; name = 'Studio'; example = $true; hostname = '' }) } }
        'profile' { Assert-Test ($Request.id -eq 'my-studio' -and $Request.name -eq 'Mon studio') 'Profile answers were lost.'; return @{} }
        'prepare' { return @{ files = @('sites/my-studio/site.ts', '.cadrora/deployments/my-studio.json') } }
        'configure' {
            Assert-Test ($env:CLOUDFLARE_API_TOKEN -eq 'private-token' -and $env:TURNSTILE_SECRET_KEY -eq 'private-turnstile') 'Secrets did not reach configuration.'
            return @{}
        }
        'publish' {
            Write-SetupJson (Join-Path $directory 'github-state.json') @{ commit = ('b' * 40); pushedCommit = ('b' * 40) }
            return @{ status = 'completed'; conclusion = 'success'; runAttempt = $script:runAttempt; runId = 42; commit = ('b' * 40); url = 'https://github.com/owner/Cadrora/actions/runs/42' }
        }
        'status' { return @{ status = 'completed'; conclusion = 'success'; runAttempt = $script:runAttempt; runId = 42; commit = ('b' * 40); url = 'https://github.com/owner/Cadrora/actions/runs/42' } }
        'settings' { return @{ changed = $script:keysChanged } }
        'refresh' {
            $script:keysChanged = $false
            $script:runAttempt++
            $script:deploymentProof = 'refreshed-deployment|domain'
            return @{ status = 'completed'; conclusion = 'success'; runAttempt = $script:runAttempt; runId = 42; commit = ('b' * 40); url = 'https://github.com/owner/Cadrora/actions/runs/42' }
        }
        default { throw "Unexpected GitHub action: $Action" }
    }
}
function Get-SetupDeploymentProof { param($Cloud, $Hostname, $Instance) return $script:deploymentProof }
function Confirm-SetupWebsite { param($Hostname) return $script:siteReady }
function Confirm-SetupFirstLogin { param($Hostname, $Directory, $Evidence) return $script:loginReady }
$cloud = @{ Account = ('a' * 32); SiteKey = 'public-site-key'; Token = (ConvertTo-SecureString 'private-token' -AsPlainText -Force); Turnstile = (ConvertTo-SecureString 'private-turnstile' -AsPlainText -Force) }
try {
    Start-SetupSession $directory 'my-studio'
    Set-SetupAnswer 'language' 'fr'
    foreach ($answer in @('', '', 'Mon studio', '')) { $script:answers.Enqueue($answer) }
    Assert-Test (Confirm-SetupGitHubProfile $temporary $env:CADRORA_TEST_NODE 'my-studio') 'Profile setup stopped.'
    Assert-Test ((Get-SetupAnswer 'profile') -eq 'my-studio') 'Profile not saved.'
    Assert-Test ((Get-SetupAnswer 'githubEnvironment') -eq 'my-studio-production') 'Environment not saved.'
    # Simulate interruption after creating the folder but before saving profile.
    $script:SetupSession.State.answers.Remove('profile')
    Set-SetupAnswer 'profilePendingId' 'my-studio'
    Stop-SetupSession
    Start-SetupSession $directory 'my-studio'
    Assert-Test (Confirm-SetupGitHubProfile $temporary $env:CADRORA_TEST_NODE 'my-studio') 'Interrupted profile creation did not resume.'
    Assert-Test ((Get-SetupAnswer 'profile') -eq 'my-studio') 'Interrupted profile id was lost.'
    Assert-Test (-not (Get-SetupAnswer 'profilePendingId')) 'Pending profile checkpoint was not cleared.'
    $script:answers.Enqueue('STOP')
    Assert-Test (-not (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com')) 'STOP published the site.'
    Assert-Test (-not $script:calls.Contains('configure') -and -not $script:calls.Contains('publish')) 'STOP mutated GitHub.'
    $script:answers.Enqueue('')
    Assert-Test (-not (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com')) 'Missing HTTPS was marked ready.'
    Assert-Test ($script:calls.Contains('configure') -and $script:calls.Contains('publish')) 'Enter did not configure and publish.'
    $script:calls.Clear()
    Stop-SetupSession
    Start-SetupSession $directory 'my-studio'
    $script:siteReady = $true
    Assert-Test (-not (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com')) 'Login was assumed successful.'
    $script:loginReady = $true
    Assert-Test (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com') 'Resume did not finish.'
    Assert-Test (-not $script:calls.Contains('publish') -and -not $script:calls.Contains('configure')) 'Resume repeated publication or secret writes.'
    Assert-Test ($script:SetupSession.State.publication.proof -eq 'deployment|domain') 'Deployment proof missing.'
    $script:SetupSession.State.publication.fingerprint = "github|owner/Cadrora|$('b' * 40)|42"
    $script:deploymentProof = 'unexpected-legacy-change|domain'
    $legacyRejected = $false
    try { Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com' | Out-Null }
    catch { $legacyRejected = $_.Exception.Message -eq (Get-SetupText 'githubDeploymentChanged') }
    Assert-Test $legacyRejected 'Legacy checkpoint accepted a changed deployment in the same attempt.'
    $script:deploymentProof = 'deployment|domain'
    $script:calls.Clear()
    $script:keysChanged = $true
    $script:answers.Enqueue('STOP')
    Assert-Test (-not (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com')) 'Key refresh ignored STOP.'
    Assert-Test (-not $script:calls.Contains('refresh')) 'STOP wrote new keys.'
    $script:answers.Enqueue('')
    Assert-Test (Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com') 'Approved key refresh did not finish.'
    Assert-Test ($script:calls.Contains('refresh')) 'New keys were ignored after the first push.'
    Assert-Test ($script:SetupSession.State.publication.proof -eq 'refreshed-deployment|domain') 'Approved new attempt did not update deployment proof.'
    Assert-Test (-not (Reset-SetupTargetAnswers)) 'A prepared GitHub target was reset.'
    function Get-SetupDeploymentProof { param($Cloud, $Hostname, $Instance) return 'changed-deployment|domain' }
    $changedRejected = $false
    try { Invoke-SetupGitHubPublication $temporary $env:CADRORA_TEST_NODE $cloud 'my-studio' 'photos.example.com' | Out-Null }
    catch { $changedRejected = $_.Exception.Message -eq (Get-SetupText 'githubDeploymentChanged') }
    Assert-Test $changedRejected 'A changed remote deployment was accepted as the old publication.'
    Assert-Test ($script:SetupSession.State.publication.proof -eq 'refreshed-deployment|domain') 'Original deployment proof was overwritten.'
    $visible = ($script:screen -join "`n") + (Get-Content (Join-Path $directory 'progress.json') -Raw)
    Assert-Test ($visible -notmatch 'private-token|private-turnstile') 'Secret leaked into progress or console.'
    Assert-Test (-not $env:CLOUDFLARE_API_TOKEN) 'Cloudflare environment was not restored.'
    Write-Output 'Windows GitHub setup checks passed'
} finally {
    Stop-SetupSession
    $cloud.Token.Dispose(); $cloud.Turnstile.Dispose()
    $resolved = [IO.Path]::GetFullPath($temporary)
    if (-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe cleanup target.' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
