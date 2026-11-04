# GitHub owns authentication; the wizard never reads or stores a GitHub token.
function Invoke-SetupGitHubHelper {
    param([string]$Root, [string]$Node, [string]$Action, [hashtable]$Request)
    $directory = Split-Path $script:SetupSession.Path
    $requestPath = Join-Path $directory 'github-request.json'
    $resultPath = Join-Path $directory 'github-result.json'
    Write-SetupJson $requestPath $Request
    if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath -Force }
    Push-Location $Root
    try { & $Node (Join-Path $PSScriptRoot 'githubSetup.mjs') $Action $requestPath $resultPath | Out-Null }
    finally { Pop-Location }
    if (-not (Test-Path -LiteralPath $resultPath)) { throw (Get-SetupText 'githubCommandFailed') }
    $response = ConvertTo-SetupMap (Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if (-not $response.ok) {
        if ($response.ContainsKey('logPath')) { Write-SetupText ((Get-SetupText 'commandLog') -f $response.logPath) }
        $message = Get-SetupText $response.error
        if (-not $message) { $message = Get-SetupText 'githubCommandFailed' }
        throw $message
    }
    return $response.value
}

function Find-SetupGitHubTool {
    param([string]$Name)
    $found = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    $candidates = if ($Name -eq 'git') {
        @("$env:ProgramFiles/Git/cmd/git.exe", "$env:LOCALAPPDATA/Programs/Git/cmd/git.exe")
    } else { @("$env:ProgramFiles/GitHub CLI/gh.exe", "$env:LOCALAPPDATA/Programs/GitHub CLI/gh.exe") }
    foreach ($path in $candidates) { if (Test-Path -LiteralPath $path) { return $path } }
    return ''
}

function Confirm-SetupGitHubTools {
    param([string]$Node)
    $script:SetupNode = $Node
    Write-SetupBlock (Get-SetupText 'githubTools')
    foreach ($tool in @('git', 'gh')) {
        $path = Find-SetupGitHubTool $tool
        while (-not $path) {
            $id = if ($tool -eq 'git') { 'Git.Git' } else { 'GitHub.cli' }
            $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
            if ($winget) {
                Write-SetupNotice ((Get-SetupText 'githubInstallingTool') -f $id)
                try { Invoke-SetupCommand $winget.Source @('install', '--id', $id, '--exact', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity') }
                catch { Write-SetupNotice (Get-SetupText 'githubToolInstallFailed') 'Warning' }
                $env:PATH = $env:PATH + ';' + [Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH', 'User')
                $path = Find-SetupGitHubTool $tool
                if ($path) { break }
            }
            $url = if ($tool -eq 'git') { 'https://git-scm.com/downloads/win' } else { 'https://cli.github.com/' }
            Write-SetupBlock ((Get-SetupText 'githubToolManual') -f $id, $url)
            $answer = (Read-SetupPrompt (Get-SetupText 'stepAction') -Default 'done' -DefaultLabel (Get-SetupText 'continueDefault')).ToLowerInvariant()
            if ($answer -eq 'stop') { return $false }
            if ($answer -in @('open', 'ouvrir')) { Start-Process $url -WindowStyle Normal; continue }
            $path = Find-SetupGitHubTool $tool
        }
        if ($tool -eq 'git') { $env:CADRORA_GIT_EXE = $path }
        else { $env:CADRORA_GH_EXE = $path }
        $env:PATH = (Split-Path $path) + ';' + $env:PATH
    }
    while ($true) {
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $env:CADRORA_GH_EXE auth status --hostname github.com *> $null
        $authStatus = $LASTEXITCODE
        $ErrorActionPreference = $previousPreference
        if ($authStatus -eq 0) { break }
        Write-SetupBlock (Get-SetupText 'githubLogin')
        $answer = Read-SetupPrompt (Get-SetupText 'stepAction') -Default 'done' -DefaultLabel (Get-SetupText 'continueDefault')
        if ($answer -eq 'stop') { return $false }
        # The device code and browser instructions are intentionally visible.
        $previousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $env:CADRORA_GH_EXE auth login --hostname github.com --git-protocol https --web --scopes repo,workflow 2>&1 | ForEach-Object { Write-Host $_.ToString() }
        } finally { $ErrorActionPreference = $previousPreference }
    }
    $previousPreference = $ErrorActionPreference
    try { $ErrorActionPreference = 'Continue'; & $env:CADRORA_GH_EXE auth setup-git --hostname github.com *> $null; $gitAuthStatus = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previousPreference }
    if ($gitAuthStatus -ne 0) { throw (Get-SetupText 'githubPermissions') }
    return $true
}

function Confirm-SetupGitHubProfile {
    param([string]$Root, [string]$Node, [string]$Instance)
    if (-not (Confirm-SetupGitHubTools $Node)) { return $false }
    Set-SetupStep 'github-repository' 'running'
    while ($true) {
        try { $repository = Invoke-SetupGitHubHelper $Root $Node 'inspect' @{}; break }
        catch {
            Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + $_.Exception.Message) -Accent Yellow
            $choice = Read-SetupPrompt (Get-SetupText 'githubRetry') -Default '1'
            if ($choice -eq '0' -or $choice -eq 'stop') { return $false }
        }
    }
    Set-SetupAnswer 'githubRepository' $repository.repository
    Set-SetupAnswer 'githubBranch' $repository.branch
    Set-SetupAnswer 'githubEnvironment' "$Instance-production"
    Set-SetupStep 'github-repository' 'completed' "$($repository.repository)|$($repository.branch)"
    Write-SetupBlock ((Get-SetupText 'githubRepositoryReady') -f $repository.repository, $repository.branch)
    $selected = Get-SetupAnswer 'profile'
    $pending = Get-SetupAnswer 'profilePendingId'
    if (-not $selected -and $pending) {
        Invoke-SetupGitHubHelper $Root $Node 'profile' @{ id = $pending; name = (Get-SetupAnswer 'profileName'); language = (Get-SetupAnswer 'profileLanguage') } | Out-Null
        Set-SetupAnswer 'profile' $pending
        $script:SetupSession.State.answers.Remove('profilePendingId')
        Set-SetupStep 'profile' 'completed' $pending
        Write-SetupNotice ((Get-SetupText 'profileSelected') -f $pending) 'Success'
        return $true
    }
    if ($selected) {
        if (-not @($repository.profiles | Where-Object { $_.id -eq $selected }).Count) {
            if ((Get-SetupAnswer 'profileCreated') -ne 'true') { throw (Get-SetupText 'profileMissing') }
            Invoke-SetupGitHubHelper $Root $Node 'profile' @{ id = $selected; name = (Get-SetupAnswer 'profileName'); language = (Get-SetupAnswer 'profileLanguage') } | Out-Null
        }
        Write-SetupNotice ((Get-SetupText 'profileSelected') -f $selected) 'Success'
        return $true
    }
    Write-SetupBlock (Get-SetupText 'profileChoose')
    # Upstream-owned examples have pinned production targets. A fork must never
    # accidentally adopt Atelier Giulia's domain or enable showcase demo access.
    $profiles = @($repository.profiles | Where-Object { -not $_.example })
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        Write-SetupText ("$($i + 2). $($profiles[$i].name) [$($profiles[$i].id)] $($profiles[$i].hostname)")
    }
    while ($true) {
        $choice = Read-SetupPrompt (Get-SetupText 'recoveryChoice') -Default '1'
        if ($choice -in @('0', 'stop')) { return $false }
        $number = 0
        if ([int]::TryParse($choice, [ref]$number) -and $number -ge 1 -and $number -le ($profiles.Count + 1)) { break }
        Write-SetupNotice (Get-SetupText 'invalid') 'Warning'
    }
    if ($number -eq 1) {
        $id = Read-SetupValue 'profileId' '^(?=.{1,30}$)(?!studio$|cadrora$|atelier-giulia$)[a-z0-9]+(?:-[a-z0-9]+)*$' $Instance
        $name = Read-SetupValue 'profileName' '^[^\r\n\x00-\x1f]{1,80}$' $id
        $language = Read-SetupValue 'profileLanguage' '^(fr|en)$' (Get-SetupAnswer 'language')
        # Save the intent before creating the directory, so a restart adopts it.
        Set-SetupAnswer 'profileName' $name
        Set-SetupAnswer 'profileLanguage' $language
        Set-SetupAnswer 'profileCreated' 'true'
        Set-SetupAnswer 'profilePendingId' $id
        try { Invoke-SetupGitHubHelper $Root $Node 'profile' @{ id = $id; name = $name; language = $language } | Out-Null }
        catch {
            $script:SetupSession.State.answers.Remove('profilePendingId')
            Save-SetupProgress
            throw
        }
        Set-SetupAnswer 'profile' $id
        $script:SetupSession.State.answers.Remove('profilePendingId')
    } else {
        $id = $profiles[$number - 2].id
        Set-SetupAnswer 'profileCreated' 'false'
        Set-SetupAnswer 'profile' $id
    }
    Set-SetupStep 'profile' 'completed' $id
    Write-SetupNotice ((Get-SetupText 'profileSelected') -f $id) 'Success'
    return $true
}

function Open-SetupGitHubRun {
    param([string]$Url)
    $repository = Get-SetupAnswer 'githubRepository'
    if ($Url -notmatch ('^https://github\.com/' + [regex]::Escape($repository) + '/actions(?:/runs/[0-9]+)?$')) { throw (Get-SetupText 'githubRunInvalid') }
    try { Start-Process $Url -WindowStyle Normal } catch { }
    Write-SetupText $Url -Color Blue
}

function Invoke-SetupGitHubPublication {
    param([string]$Root, [string]$Node, [hashtable]$Cloud, [string]$Instance, [string]$Hostname)
    $directory = Split-Path $script:SetupSession.Path
    $config = [ordered]@{ schemaVersion = 1; repository = (Get-SetupAnswer 'githubRepository'); branch = (Get-SetupAnswer 'githubBranch');
        profile = (Get-SetupAnswer 'profile'); instance = $Instance; hostname = $Hostname; environment = (Get-SetupAnswer 'githubEnvironment') }
    $config = [hashtable]$config
    $names = @('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'TURNSTILE_SECRET_KEY', 'VITE_TURNSTILE_SITE_KEY', 'CADRORA_SITE')
    $saved = @{}
    foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        $env:CLOUDFLARE_ACCOUNT_ID = $Cloud.Account
        $env:CLOUDFLARE_API_KEY = $null; $env:CLOUDFLARE_EMAIL = $null
        $env:VITE_TURNSTILE_SITE_KEY = $Cloud.SiteKey; $env:CADRORA_SITE = $config.profile
        Set-SetupSecret 'CLOUDFLARE_API_TOKEN' $Cloud.Token
        Set-SetupSecret 'TURNSTILE_SECRET_KEY' $Cloud.Turnstile
        $githubStatePath = Join-Path $directory 'github-state.json'
        $run = $null
        if (Test-Path -LiteralPath $githubStatePath) {
            $state = ConvertTo-SetupMap (Get-Content -LiteralPath $githubStatePath -Raw -Encoding UTF8 | ConvertFrom-Json)
            if ($state.ContainsKey('pushedCommit')) { $run = Invoke-SetupGitHubHelper $Root $Node 'status' $config }
        }
        if (-not $run) {
            $prepared = Invoke-SetupGitHubHelper $Root $Node 'prepare' $config
            Write-SetupBlock ((Get-SetupText 'githubSummary') -f $config.repository, $config.branch, $config.profile, $Hostname, $config.environment)
            foreach ($file in $prepared.files) { Write-SetupText $file }
            $approval = Read-SetupPrompt (Get-SetupText 'githubConfirm') -Default 'PUBLISH' -DefaultLabel (Get-SetupText 'githubPublishDefault')
            if ($approval -ne 'PUBLISH') { Write-SetupText (Get-SetupText 'paused'); return $false }
            Add-SetupEvent 'decision' 'github-publication' 'approved'
            Push-Location $Root
            try { Invoke-SetupCommand $Node @('scripts/setup/instancePreflight.mjs', '--instance', $Instance, '--hostname', $Hostname, '--confirm') }
            finally { Pop-Location }
            Write-SetupBlock (Get-SetupText 'githubConfiguring')
            Set-SetupStep 'github-configuration' 'running'
            Invoke-SetupGitHubHelper $Root $Node 'configure' $config | Out-Null
            Set-SetupStep 'github-configuration' 'completed' $config.environment
            Set-SetupStep 'github-publication' 'running'
            $script:SetupSession.State.deploymentStarted = $true
            Save-SetupProgress
            $run = Invoke-SetupGitHubHelper $Root $Node 'publish' $config
        }
        Write-SetupBlock (Get-SetupText 'githubWatching')
        Write-SetupText $run.url -Color Blue
        $polls = 0
        while ($true) {
            if ($run.status -eq 'completed') {
                if ($run.conclusion -eq 'rerun-unconfirmed') { Write-SetupNotice (Get-SetupText 'githubRerunUnconfirmed') 'Warning' }
                $settings = Invoke-SetupGitHubHelper $Root $Node 'settings' $config
                if ($settings.changed) {
                    Write-SetupBlock (Get-SetupText 'githubKeysChanged') -Accent Yellow
                    $answer = Read-SetupPrompt (Get-SetupText 'githubKeysConfirm') -Default 'PUBLISH' -DefaultLabel (Get-SetupText 'githubPublishDefault')
                    if ($answer -ne 'PUBLISH') { Write-SetupText (Get-SetupText 'paused'); return $false }
                    Add-SetupEvent 'decision' 'github-key-refresh' 'approved'
                    $run = Invoke-SetupGitHubHelper $Root $Node 'refresh' $config
                    $polls = 0
                    continue
                }
            }
            if ($run.status -eq 'completed' -and $run.conclusion -eq 'success') { break }
            if ($run.status -eq 'completed' -or $polls -ge 30) {
                Write-SetupBlock (Get-SetupText 'githubRunRecovery') -Accent Yellow
                $answer = Read-SetupPrompt (Get-SetupText 'recoveryChoice') -Default '1'
                if ($answer -in @('0', 'stop')) { return $false }
                if ($answer -eq '2') { Open-SetupGitHubRun $run.url; continue }
                if ($answer -eq '3') {
                    Invoke-SetupGitHubHelper $Root $Node 'configure' $config | Out-Null
                    $run = Invoke-SetupGitHubHelper $Root $Node 'retry' $config; $polls = 0; continue
                }
                $polls = 0
            }
            if ($polls % 2 -eq 0) { Write-SetupNotice (Get-SetupText 'githubRunWaiting') }
            Start-Sleep -Seconds 10
            $run = Invoke-SetupGitHubHelper $Root $Node 'status' $config
            $polls++
        }
        Set-SetupStep 'github-publication' 'completed' "$($run.commit)|$($run.runId)"
        $release = "github|$($config.repository)|$($run.commit)|$($run.runId)|$($run.runAttempt)"
        $proof = Get-SetupDeploymentProof $Cloud $Hostname $Instance
        if (-not $proof) { throw (Get-SetupText 'deploymentUnverified') }
        $previous = $script:SetupSession.State.publication
        $legacyRelease = "github|$($config.repository)|$($run.commit)|$($run.runId)"
        $sameAttempt = $previous.ContainsKey('fingerprint') -and ($previous.fingerprint -eq $release -or ($previous.fingerprint -eq $legacyRelease -and $run.runAttempt -eq 1))
        if ($previous.ContainsKey('proof') -and $previous.proof -and $previous.proof -ne $proof -and $sameAttempt) {
            throw (Get-SetupText 'githubDeploymentChanged')
        }
        $script:SetupSession.State.publication = @{ fingerprint = $release; proof = $proof }
        Save-SetupProgress
        Set-SetupStep 'deployment' 'completed' 'github-action-and-live-cloudflare-proof'
        if (-not (Confirm-SetupWebsite $Hostname)) { return $false }
        if (-not (Confirm-SetupFirstLogin $Hostname $directory "$release|$proof")) { return $false }
        $script:SetupSession.State.publication.proof = $proof
        Save-SetupProgress
        Write-SetupBlock ((Get-SetupText 'githubDone') -f $Hostname, $config.repository, $config.branch, $config.profile, (Join-Path $directory 'admin-credentials.env')) -Accent Green
        return $true
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    }
}
