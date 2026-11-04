# Offline integration: real state files and DPAPI, mocked browser/provider/commands.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repository = Split-Path (Split-Path $PSScriptRoot)
. (Join-Path $repository 'scripts/setup/windows.ps1')
$script:SetupText = Get-Content (Join-Path $repository 'scripts/setup/messages.en.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Assert-SetupTest([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$minimums = Get-NodeMinimums $repository
Assert-SetupTest (Test-SetupNode $env:CADRORA_TEST_NODE $minimums) 'Supported Node rejected.'
Assert-SetupTest (-not (Test-SetupNode 'C:\nonexistent-node.exe' $minimums)) 'Missing Node accepted.'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('cadrora-wizard-test-' + [guid]::NewGuid().ToString('N'))
foreach ($folder in @('scripts/setup', 'sites', 'src')) { New-Item -ItemType Directory -Path (Join-Path $fixture $folder) -Force | Out-Null }
Copy-Item (Join-Path $repository 'package.json') $fixture
Copy-Item (Join-Path $repository 'package-lock.json') $fixture
Copy-Item (Join-Path $repository 'scripts/setup/messages.*.json') (Join-Path $fixture 'scripts/setup')
$script:commands = New-Object 'System.Collections.Generic.List[string]'
$script:answers = New-Object 'System.Collections.Generic.Queue[string]'
$script:prompts = New-Object 'System.Collections.Generic.List[string]'
$script:pages = New-Object 'System.Collections.Generic.List[string]'
$script:requests = New-Object 'System.Collections.Generic.List[string]'
$script:zoneStates = New-Object 'System.Collections.Generic.Queue[string]'
$script:browserFails = $false
$script:providerFails = $false
$script:tokenRejections = 0
$script:deployProofFails = $false
$script:r2Ready = $false
$script:dependenciesReady = $false
$script:installFailures = 0
$script:installFailureCode = -4082
$script:turnstileSecret = 'private-turnstile'
$script:deploymentId = '11111111-1111-1111-1111-111111111111'
$script:domainFixture = [pscustomobject]@{ id = ('d' * 38); hostname = 'photos.example.com'; service = 'cadrora-test-studio'; enabled = $true }
$script:failCommand = ''
$script:failOnce = $false
$script:websiteReady = $true
$script:websiteStatus = 200
$script:websiteHtml = '<div id="root"></div>'
$script:websiteRequests = New-Object 'System.Collections.Generic.List[string]'
function Queue-Answers([string[]]$Values) { foreach ($value in $Values) { $script:answers.Enqueue($value) } }
function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    $script:prompts.Add($Prompt)
    if ($script:answers.Count -eq 0) { throw "Unexpected prompt: $Prompt" }
    $answer = $script:answers.Dequeue()
    if ($AsSecureString) {
        if (-not $answer) { return (New-Object Security.SecureString) }
        return ConvertTo-SecureString $answer -AsPlainText -Force
    }
    return $answer
}
function Find-SetupNode { param($Root, $Minimums) return $env:CADRORA_TEST_NODE }
function Start-Process {
    param([string]$FilePath, [string]$WindowStyle, [string]$ErrorAction, [string]$ArgumentList)
    Assert-SetupTest ($WindowStyle -eq 'Normal') 'Interactive browser hidden.'
    if ($script:browserFails) { throw 'No browser association' }
    $script:pages.Add($FilePath)
    if ($FilePath -like '*/r2/overview') { $script:r2Ready = $true }
}
function Invoke-RestMethod {
    param([string]$Uri, [string]$Method, $Headers, $TimeoutSec, $ErrorAction)
    Assert-SetupTest ($Method -eq 'Get') 'State check tried to mutate Cloudflare.'
    Assert-SetupTest ($Headers.Authorization -in @('Bearer private-token', 'Bearer replacement-token')) 'Wrong API token.'
    Assert-SetupTest ($Uri -notmatch 'private-token|private-turnstile') 'Secret in a URL.'
    $script:requests.Add($Uri)
    if ($script:providerFails) { throw 'Sensitive provider exception must not be logged' }
    if ($script:tokenRejections -gt 0) {
        $script:tokenRejections--
        $rejection = New-Object System.InvalidOperationException 'API key rejected'
        $rejection | Add-Member -NotePropertyName Response -NotePropertyValue ([pscustomobject]@{ StatusCode = 403 })
        throw $rejection
    }
    if ($Uri -match '/r2/buckets$') { return [pscustomobject]@{ success = $script:r2Ready; result = [pscustomobject]@{ buckets = @() } } }
    if ($Uri -match '/challenges/widgets/') { return [pscustomobject]@{ success = $true; result = [pscustomobject]@{
        sitekey = 'public-site-key'; secret = $script:turnstileSecret; domains = @('photos.example.com'); mode = 'managed'; clearance_level = 'no_clearance'
    } } }
    if ($Uri -match '/deployments$') {
        if ($script:deployProofFails) { throw 'Transient deployment discovery failure' }
        return [pscustomobject]@{ success = $true; result = [pscustomobject]@{ deployments = @([pscustomobject]@{ id = $script:deploymentId }) } }
    }
    if ($Uri -match '/workers/domains\?') { return [pscustomobject]@{ success = $true; result = @($script:domainFixture) } }
    $zones = @()
    if ($Uri -match 'name=example.com&') {
        $status = if ($script:zoneStates.Count) { $script:zoneStates.Dequeue() } else { 'active' }
        $zones = @([pscustomobject]@{ name = 'example.com'; account = [pscustomobject]@{ id = ('a' * 32) }; status = $status })
    }
    return [pscustomobject]@{ success = $true; result = $zones }
}
function Invoke-WebRequest {
    param([string]$Uri, [switch]$UseBasicParsing, $TimeoutSec, $MaximumRedirection, $Headers, $ErrorAction)
    Assert-SetupTest ($Uri -match '^https://photos.example.com/((fr|en)/contact/|admin/login)?$') 'Unexpected readiness URL.'
    Assert-SetupTest ($MaximumRedirection -eq 0 -and -not $Headers.ContainsKey('Authorization')) 'Website probe followed redirects or sent credentials.'
    $script:websiteRequests.Add($Uri)
    if (-not $script:websiteReady) { throw 'Certificate not ready' }
    return @{ StatusCode = $script:websiteStatus; Headers = @{ 'Content-Type' = 'text/html; charset=utf-8' }; Content = $script:websiteHtml }
}
function Get-SetupDependencyEvidence {
    param($Root, $Npm, $Node)
    if ($script:dependenciesReady) { return 'current-lock-and-installed-tree' }
    return ''
}
function Invoke-SetupCommand {
    param([string]$Command, [string[]]$Arguments)
    $line = $Arguments -join ' '
    $script:commands.Add($line)
    if ($line -eq 'ci') {
        Assert-SetupTest (-not $env:CLOUDFLARE_API_TOKEN) 'Private token reached npm installation.'
        if ($script:installFailures -gt 0) {
            $script:installFailures--
            $failure = [Exception]::new('Simulated npm failure')
            $failure.Data['ExitCode'] = $script:installFailureCode
            throw $failure
        }
        $script:dependenciesReady = $true
    }
    if ($line -like 'scripts/instances/*') {
        Assert-SetupTest ($env:CLOUDFLARE_API_TOKEN -eq 'private-token') 'Token missing at deployment.'
        Assert-SetupTest ($env:CADRORA_SITE -eq 'studio' -and $env:CADRORA_SEED_DEMO -eq 'false') 'Wrong site configuration.'
        Assert-SetupTest (-not $env:ADMIN_SECRET_HASH) 'Unrelated credential inherited.'
        $credential = Join-Path $fixture '.artifacts/instances/test-studio/admin-credentials.env'
        if (-not (Test-Path $credential)) { Set-Content -LiteralPath $credential 'preserved-admin-credential-fixture' }
    }
    if ($line -eq $script:failCommand) {
        if ($script:failOnce) { $script:failCommand = ''; $script:failOnce = $false }
        throw 'Simulated command failure'
    }
}
function Read-Progress { Get-Content (Join-Path $fixture '.artifacts/instances/test-studio/progress.json') -Raw | ConvertFrom-Json }
function Reset-Observations { $script:commands.Clear(); $script:pages.Clear(); $script:requests.Clear(); Assert-SetupTest ($script:answers.Count -eq 0) 'Unused answers remain.' }
$oldToken = $env:CLOUDFLARE_API_TOKEN
$oldHash = $env:ADMIN_SECRET_HASH
$oldDemo = $env:CADRORA_SEED_DEMO
$oldPath = $env:PATH
$oldLocation = (Get-Location).Path
try {
    Invoke-CadroraSetup -Local -Root $fixture -Language en -Diagnose
    Assert-SetupTest (-not (Test-Path (Join-Path $fixture '.artifacts'))) 'Diagnostic wrote state.'
    Assert-SetupTest ($script:pages.Count -eq 0 -and $script:requests.Count -eq 0) 'Diagnostic contacted provider.'
    # Real Windows locks; only the waiting is shortened for offline tests.
    $writeProbe = Join-Path $fixture 'write-probe.json'
    Write-SetupJson $writeProbe @{ revision = 1 }
    Write-SetupJson $writeProbe @{ revision = 2 }
    $script:saveWaits = 0
    $script:releaseSaveLock = $true
    $script:saveLock = $null
    function Start-Sleep {
        param([int]$Milliseconds)
        Assert-SetupTest ($Milliseconds -gt 0 -and $Milliseconds -le 1000) 'Unbounded save retry delay.'
        $script:saveWaits++
        if ($script:releaseSaveLock -and $script:saveWaits -eq 2) { $script:saveLock.Dispose() }
    }
    try {
        foreach ($lockedPath in @($writeProbe, "$writeProbe.bak")) {
            $previous = [IO.File]::ReadAllText($writeProbe)
            $script:saveWaits = 0
            $script:saveLock = [IO.File]::Open($lockedPath, 'Open', 'Read', 'Read')
            try { Write-SetupJson $writeProbe @{ revision = 3 } }
            finally { $script:saveLock.Dispose() }
            Assert-SetupTest ($script:saveWaits -eq 2) 'Temporary target/backup lock was not retried.'
            Assert-SetupTest ((Get-Content $writeProbe -Raw | ConvertFrom-Json).revision -eq 3) 'Retry lost the new state.'
            Assert-SetupTest ([IO.File]::ReadAllText("$writeProbe.bak") -eq $previous) 'Retry lost the previous complete state.'
        }
        $lockedDirectory = Join-Path $fixture '.artifacts/instances/locked-state'
        Start-SetupSession $lockedDirectory 'locked-state'
        Set-SetupStep 'token' 'running'
        $lockedProgress = Join-Path $lockedDirectory 'progress.json'
        $previous = [IO.File]::ReadAllText($lockedProgress)
        $previousBackup = [IO.File]::ReadAllText("$lockedProgress.bak")
        $script:saveWaits = 0; $script:releaseSaveLock = $false
        $script:saveLock = [IO.File]::Open($lockedProgress, 'Open', 'Read', 'Read')
        try {
            try { Save-SetupProgress; throw 'Expected persistent save failure' }
            catch { Assert-SetupTest ($_.Exception.Message -like '*Could not save progress or keys*') 'Persistent save failure has no recovery instructions.' }
            Assert-SetupTest ($script:saveWaits -eq 7) 'Save retries are not bounded.'
            Assert-SetupTest ([IO.File]::ReadAllText($lockedProgress) -eq $previous) 'Locked progress was overwritten.'
            Assert-SetupTest ([IO.File]::ReadAllText("$lockedProgress.bak") -eq $previousBackup) 'Locked save damaged its backup.'
            Assert-SetupTest (@(Get-ChildItem $lockedDirectory -Filter '*.tmp').Count -eq 1) 'Failed save discarded its recovery file.'
            Stop-SetupSession
            Assert-SetupTest ($script:saveWaits -eq 7) 'Cleanup retried a failed save and hid the original error.'
            try { Start-SetupSession $lockedDirectory 'locked-state'; throw 'Expected blocked resume' }
            catch { Assert-SetupTest ($_.Exception.Message -like '*Could not save progress or keys*') 'Blocked resume lost the save error.' }
            Assert-SetupTest ($null -eq $script:SetupSession) 'Failed resume retained a disposed session.'
        } finally { $script:saveLock.Dispose() }
        Start-SetupSession $lockedDirectory 'locked-state'
        Assert-SetupTest ($script:SetupSession.State.steps.token.status -eq 'interrupted') 'Unlocked resume lost the interrupted checkpoint.'
        Stop-SetupSession
    } finally {
        if ($script:saveLock) { $script:saveLock.Dispose() }
        Remove-Item Function:\Start-Sleep
    }
    Queue-Answers @('test-studio', 'photos.example.com', 'stop')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    $progress = Read-Progress
    Assert-SetupTest ($progress.answers.hostname -eq 'photos.example.com' -and $progress.steps.account.status -eq 'stopped') 'Stop did not save answers/checkpoint.'
    Assert-SetupTest ($script:commands.Count -eq 0) 'Stop ran a command.'
    Reset-Observations

    $env:CLOUDFLARE_API_TOKEN = 'caller-token'
    $env:ADMIN_SECRET_HASH = 'caller-hash'
    $env:CADRORA_SEED_DEMO = 'true'
    $initialFingerprint = Get-SetupSourceFingerprint $fixture
    $script:failCommand = 'run test -- --maxWorkers=2'
    Queue-Answers @('test-studio', '', 'ouvrir', 'https://dash.cloudflare.com/', ('https://dash.cloudflare.com/' + ('a' * 32) + '/domains/overview?view=list'), '', '', 'private-token', '', '', 'public-site-key', 'private-turnstile', '')
    try { Invoke-CadroraSetup -Local -Root $fixture -Language en; throw 'Expected command failure' }
    catch { Assert-SetupTest ($_.Exception.Message -eq 'Simulated command failure') $_.Exception.Message }
    $progress = Read-Progress
    Assert-SetupTest ($progress.steps.tests.status -eq 'failed' -and $progress.steps.check.status -eq 'completed') 'Failure lost successful previous steps.'
    Assert-SetupTest ($progress.answers.accountId -eq ('a' * 32)) 'Account answer not recorded.'
    Assert-SetupTest (@($progress.history | Where-Object { $_.name -eq 'deploy-confirmation' -and $_.value -eq 'DEPLOY' }).Count -eq 1) 'Enter did not approve the displayed deployment default.'
    Assert-SetupTest ($progress.history.Count -gt 10) 'Decision/status history missing.'
    $instanceDirectory = Join-Path $fixture '.artifacts/instances/test-studio'
    $directoryAcl = Get-Acl -LiteralPath $instanceDirectory
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $directoryRules = @($directoryAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    Assert-SetupTest ($directoryAcl.AreAccessRulesProtected -and $directoryRules.Count -eq 1) 'Instance directory inherited broader access.'
    Assert-SetupTest ($directoryRules[0].IdentityReference -eq $currentUser -and $directoryRules[0].FileSystemRights -eq 'FullControl') 'Current user lost private-directory access.'
    foreach ($privateFile in @('progress.json', 'secrets.dpapi.json')) {
        $fileAcl = Get-Acl -LiteralPath (Join-Path $instanceDirectory $privateFile)
        $fileRules = @($fileAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        Assert-SetupTest ($fileRules.Count -eq 1 -and $fileRules[0].IdentityReference -eq $currentUser -and $fileRules[0].IsInherited) 'State files did not inherit private access.'
    }
    $allState = (Get-ChildItem $instanceDirectory -File | Where-Object { $_.Extension -in @('.json', '.bak') } | ForEach-Object { Get-Content $_.FullName -Raw }) -join ''
    Assert-SetupTest ($allState -notmatch 'private-token|private-turnstile|caller-token|caller-hash|Sensitive provider') 'Private values leaked to saved state.'
    Assert-SetupTest (Test-Path (Join-Path $instanceDirectory 'progress.json.bak')) 'Atomic backup not kept.'
    Assert-SetupTest ($env:CLOUDFLARE_API_TOKEN -eq 'caller-token' -and $env:ADMIN_SECRET_HASH -eq 'caller-hash' -and $env:CADRORA_SEED_DEMO -eq 'true') 'Failure leaked environment.'
    Assert-SetupTest ($env:PATH -eq $oldPath -and (Get-Location).Path -eq $oldLocation) 'Failure changed PATH/location.'
    Assert-SetupTest ((Get-SetupSourceFingerprint $fixture) -eq $initialFingerprint) 'Failure changed build inputs.'
    Reset-Observations

    $script:failCommand = ''
    Queue-Answers @('test-studio', 'stop')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:pages.Count -eq 1 -and $script:pages[0] -eq 'https://photos.example.com/admin/login') 'First sign-in did not open.'
    Assert-SetupTest (($script:commands -join '|') -eq 'run test -- --maxWorkers=2|scripts/setup/instancePreflight.mjs --instance test-studio --hostname photos.example.com --confirm|scripts/instances/deploy.mjs --instance test-studio --hostname photos.example.com --confirm') 'Resume replayed successful work or skipped failed work.'
    Assert-SetupTest ((Read-Progress).steps.deployment.status -eq 'completed') 'Deployment not marked complete after verification.'
    Assert-SetupTest ((Read-Progress).steps.'first-login'.status -eq 'stopped') 'Stopping at sign-in falsely completed setup.'
    Reset-Observations
    Queue-Answers @('test-studio', 'password', '')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 1) 'Resuming first sign-in republished the website.'
    Assert-SetupTest ($script:pages.Contains('notepad.exe')) 'Password-file helper did not open Notepad.'
    Assert-SetupTest ((Read-Progress).steps.'first-login'.status -eq 'completed') 'User-confirmed first sign-in was not saved.'
    Reset-Observations
    Queue-Answers @('test-studio')
    Invoke-CadroraSetup -Local -Root $fixture -Language fr
    Assert-SetupTest ($script:commands.Count -eq 1 -and $script:commands[0] -like 'scripts/setup/instancePreflight*') 'Completed deployment was repeated.'
    Assert-SetupTest ($script:requests.Count -ge 5) 'Resume trusted completed flags without remote reads.'
    Reset-Observations

    $script:r2Ready = $false
    Queue-Answers @('test-studio', '')
    Invoke-CadroraSetup -Local -Root $fixture -Language fr
    Assert-SetupTest ($script:pages.Count -eq 1 -and $script:pages[0] -like '*/r2/overview') 'Missing R2 access was skipped.'
    Reset-Observations
    $script:zoneStates.Enqueue('pending'); $script:zoneStates.Enqueue('active')
    Queue-Answers @('test-studio', '2', '1')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest (@((Read-Progress).history | Where-Object { $_.name -eq 'domain' -and $_.value -eq 'failed' }).Count -gt 0) 'Domain failure not recorded.'
    Reset-Observations
    $script:providerFails = $true
    Queue-Answers @('test-studio', 'stop')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 0) 'Provider outage proceeded to deployment.'
    $script:providerFails = $false
    Reset-Observations

    $script:deploymentId = '22222222-2222-2222-2222-222222222222'
    Queue-Answers @('test-studio', 'STOP')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 1) 'External deployment overwritten without confirmation.'
    Reset-Observations
    Queue-Answers @('test-studio', 'DEPLOY', 'done')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 2) 'Explicit redeployment did not repair changed provider state.'
    Reset-Observations
    $script:dependenciesReady = $false
    $script:installFailures = 1
    Queue-Answers @('test-studio', '0')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest (($script:commands -join '|') -eq 'ci') 'Stopped dependency repair continued to deployment.'
    Assert-SetupTest ((Read-Progress).steps.dependencies.evidence -eq 'dependenciesLocked') 'Locked tools did not get specific recovery instructions.'
    Reset-Observations
    $script:installFailures = 1; $script:installFailureCode = -4048
    Queue-Answers @('test-studio', '')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest (@($script:commands | Where-Object { $_ -eq 'ci' }).Count -eq 2) 'Enter did not retry a blocked install in place.'
    Assert-SetupTest (-not $script:commands.Contains('run check')) 'Dependency retry replayed unrelated successful work.'
    Reset-Observations
    $script:dependenciesReady = $false
    $script:installFailures = 1; $script:installFailureCode = 1
    Queue-Answers @('test-studio', '0')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ((Read-Progress).steps.dependencies.evidence -eq 'dependenciesFailed') 'An unrelated npm error was mislabeled as a file lock.'
    Reset-Observations
    $script:dependenciesReady = $false
    Queue-Answers @('test-studio')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Contains('ci')) 'Missing dependencies were skipped from stale status.'
    Reset-Observations

    Set-Content -LiteralPath (Join-Path $fixture 'src/change.ts') 'export const changed = true;'
    $script:deployProofFails = $true
    Queue-Answers @('test-studio', 'DEPLOY')
    try { Invoke-CadroraSetup -Local -Root $fixture -Language en; throw 'Expected verification failure' }
    catch { Assert-SetupTest ($_.Exception.Message -like '*could not be verified*') $_.Exception.Message }
    Assert-SetupTest ($script:commands.Contains('run check') -and $script:commands.Contains('run test -- --maxWorkers=2')) 'Changed source reused stale validation.'
    Assert-SetupTest ((Read-Progress).steps.deployment.status -eq 'failed') 'Verification failure not checkpointed.'
    Reset-Observations
    # Updating the installer after a successful upload must not replay that upload.
    Set-Content -LiteralPath (Join-Path $fixture 'src/change.ts') 'export const changed = 2;'
    $script:deployProofFails = $false
    $script:websiteReady = $false
    Queue-Answers @('test-studio', 'stop')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 0) 'Pending proof recovery republished changed local files.'
    Assert-SetupTest (-not (Read-Progress).publication.proof) 'Stopping HTTPS checks lost verification-only resume.'
    Reset-Observations
    $script:websiteReady = $true
    Queue-Answers @('test-studio', '')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:commands.Count -eq 0) 'Verification retry republished completed work.'
    Assert-SetupTest ((Read-Progress).publication.proof.EndsWith(('d' * 38))) 'Opaque Cloudflare domain ID was rejected.'
    # The recovered release is the previously published source, not the local edit.
    Set-Content -LiteralPath (Join-Path $fixture 'src/change.ts') 'export const changed = true;'
    Reset-Observations

    $secretsPath = Join-Path $instanceDirectory 'secrets.dpapi.json'
    $encrypted = ConvertTo-SetupMap (Get-Content $secretsPath -Raw | ConvertFrom-Json)
    $encrypted.token = 'invalid-ciphertext'
    Write-SetupJson $secretsPath $encrypted
    Queue-Answers @('test-studio', 'private-token')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:pages.Count -eq 1 -and $script:pages[0] -like '*/api-tokens?*') 'Lost key restarted unrelated steps.'
    Reset-Observations
    $script:turnstileSecret = 'rotated-private-key'
    Queue-Answers @('test-studio', '5', 'done', '', 'rotated-private-key', 'DEPLOY', 'done')
    Invoke-CadroraSetup -Local -Root $fixture -Language en
    Assert-SetupTest ($script:pages.Count -eq 2 -and $script:pages[0] -like '*/turnstile') 'Rotated widget not repaired.'
    Reset-Observations
    Queue-Answers @('test-studio', 'private-token')
    Invoke-CadroraSetup -Local -Root $fixture -Language en -ReplaceToken
    Assert-SetupTest ($script:pages.Count -eq 1 -and $script:commands.Count -eq 1) 'ReplaceToken restarted completed work.'
    Reset-Observations

    Start-SetupSession $instanceDirectory 'test-studio'
    try {
        $script:SetupSession.State.steps.Remove('dependencies')
        $commandCount = $script:commands.Count
        Assert-SetupTest ((Confirm-SetupDependencies $fixture 'npm.cmd' $env:CADRORA_TEST_NODE) -eq 'current-lock-and-installed-tree') 'Valid dependencies were not reused without a checkpoint.'
        Assert-SetupTest ($script:commands.Count -eq $commandCount) 'Valid dependencies triggered npm ci.'
        Assert-SetupTest (-not (Reset-SetupTargetAnswers)) 'Published installation target could be cleared.'
        $script:websiteReady = $false
        Queue-Answers @('stop')
        Assert-SetupTest (-not (Confirm-SetupWebsite 'photos.example.com')) 'Missing HTTPS was treated as ready.'
        $script:websiteReady = $true
        Assert-SetupTest (Confirm-SetupWebsite 'photos.example.com') 'HTTPS recovery failed.'
        Assert-SetupTest ($script:websiteRequests.Contains('https://photos.example.com/fr/contact/') -and $script:websiteRequests.Contains('https://photos.example.com/en/contact/')) 'Localized Contact pages were not checked.'
        $script:websiteStatus = 302
        Assert-SetupTest (-not (Test-SetupWebsite 'photos.example.com')) 'Redirect was accepted as the installed website.'
        $script:websiteStatus = 200; $script:websiteHtml = '<html>Cloudflare error</html>'
        Assert-SetupTest (-not (Test-SetupWebsite 'photos.example.com')) 'An HTML error page was accepted as the app.'
        $script:websiteHtml = '<div id="root"></div>'
        foreach ($unsafe in @('http://photos.example.com/', 'https://photos.example.com:444/', 'https://photos.example.com@evil.example/')) {
            try { Open-SetupPage $unsafe; throw 'Expected unsafe URL rejection' }
            catch { Assert-SetupTest ($_.Exception.Message -like '*Only HTTPS Cloudflare*') 'Unsafe website page opened.' }
        }
        $testCloud = @{ Account = ('a' * 32); Token = (ConvertTo-SecureString 'private-token' -AsPlainText -Force); SiteKey = 'public-site-key'; Turnstile = (ConvertTo-SecureString 'rotated-private-key' -AsPlainText -Force) }
        try {
            $widgetSecret = $testCloud.Turnstile
            Assert-SetupTest ([bool](Get-SetupDeploymentProof $testCloud 'photos.example.com' 'test-studio')) 'Realistic 38-character domain ID failed verification.'
            foreach ($invalid in @(
                @{ field = 'id'; value = '' }, @{ field = 'id'; value = '  ' }, @{ field = 'id'; value = 123 },
                @{ field = 'enabled'; value = $false }, @{ field = 'hostname'; value = 'other.example.com' },
                @{ field = 'service'; value = 'other-worker' }
            )) {
                $field = $invalid.field; $original = $script:domainFixture.$field
                $script:domainFixture.$field = $invalid.value
                Assert-SetupTest (-not (Get-SetupDeploymentProof $testCloud 'photos.example.com' 'test-studio')) "Invalid domain $field accepted."
                $script:domainFixture.$field = $original
            }
            foreach ($step in @('domain', 'r2', 'turnstile')) {
                $script:tokenRejections = 1
                $pageCount = $script:pages.Count
                $promptCount = $script:prompts.Count
                Queue-Answers @('', 'private-token')
                Assert-SetupTest (Confirm-SetupCloudflareStep $step $testCloud 'photos.example.com' 'https://dash.cloudflare.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/turnstile') 'Enter did not recover the API key rejection.'
                Assert-SetupTest ($script:prompts[$promptCount] -eq '  >') 'API rejection did not offer a clear default action.'
                Assert-SetupTest ($script:pages.Count -eq $pageCount + 1 -and $script:pages[$pageCount] -like '*/api-tokens?*') 'API rejection opened the widget instead of the token form.'
                Assert-SetupTest ([object]::ReferenceEquals($widgetSecret, $testCloud.Turnstile) -and $testCloud.SiteKey -eq 'public-site-key') 'API-key recovery changed the widget keys.'
            }
            $script:tokenRejections = 1
            $pageCount = $script:pages.Count
            Queue-Answers @('9', '2')
            Assert-SetupTest (Confirm-SetupCloudflareStep 'turnstile' $testCloud 'photos.example.com' 'https://dash.cloudflare.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/turnstile') 'Explicit retry of the same API key failed.'
            Assert-SetupTest ($script:pages.Count -eq $pageCount) 'Explicit retry opened token replacement.'
            $script:tokenRejections = 1
            Queue-Answers @('0')
            Assert-SetupTest (-not (Confirm-SetupCloudflareStep 'turnstile' $testCloud 'photos.example.com' 'https://dash.cloudflare.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/turnstile')) 'Stop on API rejection continued setup.'
            $savedSecrets = Get-Content $secretsPath -Raw
            $savedToken = $testCloud.Token
            Queue-Answers @('stop')
            Assert-SetupTest (-not (Read-SetupToken $testCloud)) 'Stop at the direct token prompt continued setup.'
            Assert-SetupTest ([object]::ReferenceEquals($savedToken, $testCloud.Token)) 'Stopping replaced the active token.'
            Assert-SetupTest ((Get-Content $secretsPath -Raw) -eq $savedSecrets) 'Navigation was saved as a private key.'
            $script:failCommand = 'provider-write'; $script:failOnce = $true
            Queue-Answers @('token', 'ouvrir', 'replacement-token')
            Assert-SetupTest (Invoke-SetupCloudCommand 'deployment' $env:CADRORA_TEST_NODE @('provider-write') $testCloud 'photos.example.com') 'Token replacement did not recover a write failure.'
            Assert-SetupTest ($env:CLOUDFLARE_API_TOKEN -eq 'replacement-token') 'Replacement API key did not reach the retry.'
            Assert-SetupTest ($script:SetupSession.State.deploymentStarted) 'Write attempt did not fence target editing.'
        } finally { $testCloud.Token.Dispose(); $testCloud.Turnstile.Dispose() }
        $privateRevision = Get-SetupPrivateRevision
        $oldRevision = $script:SetupSession.State.secretRevision
        $replacement = ConvertTo-SecureString 'crash-between-state-writes' -AsPlainText -Force
        try { Save-SetupPrivateValue 'turnstile' $replacement } finally { $replacement.Dispose() }
        $script:SetupSession.State.secretRevision = $oldRevision
        Assert-SetupTest ((Get-SetupPrivateRevision) -ne $privateRevision) 'Interrupted private-store save reused stale release evidence.'
        try { Start-SetupSession $instanceDirectory 'test-studio'; throw 'Expected lock failure' }
        catch { Assert-SetupTest ($_.Exception.Message -like '*Another installer*') 'Concurrent setup allowed.' }
        try { Set-SetupAnswer 'accountId' ('b' * 32); throw 'Expected target fence' }
        catch { Assert-SetupTest ($_.Exception.Message -like '*pinned*') 'Pinned target changed.' }
        Set-SetupStep 'tests' 'running' 'interruption-fixture'
    } finally { $script:SetupSession.Lock.Dispose(); $script:SetupSession = $null }
    Start-SetupSession $instanceDirectory 'test-studio'
    Assert-SetupTest ($script:SetupSession.State.steps.tests.status -eq 'interrupted') 'Killed run treated as complete.'
    Stop-SetupSession

    $progressPath = Join-Path $instanceDirectory 'progress.json'
    $validProgress = [IO.File]::ReadAllText($progressPath)
    [IO.File]::WriteAllText($progressPath, '{broken')
    try { Start-SetupSession $instanceDirectory 'test-studio'; throw 'Expected corrupt state failure' }
    catch { Assert-SetupTest ($_.Exception.Message -like '*progress file is invalid*') 'Corrupt progress silently reset.' }
    Assert-SetupTest ([IO.File]::ReadAllText($progressPath) -eq '{broken') 'Corrupt state overwritten.'
    [IO.File]::WriteAllText($progressPath, $validProgress)

    $legacyDirectory = Join-Path $fixture '.artifacts/instances/legacy-site'
    New-Item -ItemType Directory -Path $legacyDirectory -Force | Out-Null
    @{ hostname = 'photos.example.com'; accountId = ('a' * 32); siteKey = 'public-site-key' } |
        ConvertTo-Json | Set-Content (Join-Path $legacyDirectory 'setup.json')
    Start-SetupSession $legacyDirectory 'legacy-site'
    Assert-SetupTest ((Get-SetupAnswer 'hostname') -eq 'photos.example.com' -and $script:SetupSession.State.steps.Count -eq 0) 'Legacy answers were lost or trusted as completed work.'
    Assert-SetupTest (Reset-SetupTargetAnswers) 'Unpublished answers could not be corrected.'
    Assert-SetupTest (-not (Get-SetupAnswer 'hostname') -and $script:SetupSession.Secrets.Count -eq 0) 'Correction retained old target or keys.'
    Set-SetupAnswer 'hostname' 'corrected.example.com'
    Assert-SetupTest ((Get-SetupAnswer 'hostname') -eq 'corrected.example.com') 'Corrected hostname was not saved.'
    Assert-SetupTest (@($script:SetupSession.State.history | Where-Object { $_.value -eq 'reenter-before-deployment' }).Count -eq 1) 'Correction lost its history.'
    Stop-SetupSession

    Queue-Answers @('legacy-site', 'photos.example.com', 'stop')
    Invoke-CadroraSetup -Local -Root $fixture -Language en -EditAnswers
    $corrected = Get-Content (Join-Path $legacyDirectory 'progress.json') -Raw | ConvertFrom-Json
    Assert-SetupTest ($corrected.answers.hostname -eq 'photos.example.com' -and $corrected.steps.account.status -eq 'stopped') 'EditAnswers did not reenter target setup.'

    $tokenUrl = [uri](Get-SetupTokenUrl ('a' * 32))
    Assert-SetupTest ($tokenUrl.Host -eq 'dash.cloudflare.com' -and $tokenUrl.Query.Contains('accountId=' + ('a' * 32))) 'Token template lost exact account scope.'
    $template = [uri]::UnescapeDataString(($tokenUrl.Query -split 'permissionGroupKeys=')[1].Split('&')[0]) | ConvertFrom-Json
    Assert-SetupTest ($template.Count -eq 5 -and $template.key -contains 'workers_r2' -and $template.key -contains 'd1') 'Token template permissions missing.'

    $script:browserFails = $true
    Queue-Answers @('nonsense', 'ouvrir', '')
    Assert-SetupTest (Wait-SetupBrowserStep 'Browser fallback' 'https://dash.cloudflare.com/') 'Browser fallback failed.'
    Assert-SetupTest ($script:answers.Count -eq 0) 'Enter did not finish the browser confirmation.'
    try { Open-SetupPage 'https://example.com/'; throw 'Expected unsafe page failure' }
    catch { Assert-SetupTest ($_.Exception.Message -like '*Only HTTPS Cloudflare*') 'Unsafe page opened.' }

    # A damaged bootstrap download must never be extracted or executed.
    $script:expanded = 0
    $script:badChecksum = $false
    function Invoke-WebRequest {
        param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
        $version = ($minimums | Sort-Object -Descending | Select-Object -First 1).ToString()
        Assert-SetupTest ($Uri.StartsWith("https://nodejs.org/dist/v$version/")) 'Download is not pinned to official supported Node.'
        if ($OutFile) { [IO.File]::WriteAllText($OutFile, 'fixture-archive'); return }
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes('fixture-archive')))).Replace('-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
        if ($script:badChecksum) { $hash = '0' * 64 }
        return @{ Content = "$hash  node-v$version-win-x64.zip`n$hash  node-v$version-win-arm64.zip`n" }
    }
    function Expand-Archive { param($LiteralPath, $DestinationPath, [switch]$Force) $script:expanded++ }
    function Test-SetupNode { param($Node, $Minimums) return $true }
    $installed = Install-SetupNode $fixture $minimums
    Assert-SetupTest ($script:expanded -eq 1 -and $installed -like '*node.exe') 'Verified archive was not extracted.'
    $script:badChecksum = $true
    try { Install-SetupNode $fixture $minimums; throw 'Expected checksum failure' }
    catch { Assert-SetupTest ($_.Exception.Message -like '*checksum*') 'Invalid checksum accepted.' }
    Assert-SetupTest ($script:expanded -eq 1) 'Unverified archive was extracted.'
    Write-Output 'Windows setup offline checks passed'
} finally {
    Stop-SetupSession
    $env:CLOUDFLARE_API_TOKEN = $oldToken
    $env:ADMIN_SECRET_HASH = $oldHash
    $env:CADRORA_SEED_DEMO = $oldDemo
    $resolvedFixture = [IO.Path]::GetFullPath($fixture)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedFixture.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe fixture cleanup path.' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
