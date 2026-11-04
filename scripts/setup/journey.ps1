# Interactive recovery and the final browser handoff. No remote writes here.
function Get-SetupTokenUrl {
    param([string]$Account)
    if ($Account -cnotmatch '^[a-f0-9]{32}$') { throw (Get-SetupText 'accountHelp') }
    # Documented user-token short keys. Vectorize/Turnstile are added manually:
    # unknown short keys are silently discarded by Cloudflare's template form.
    $permissions = @(
        @{ key = 'workers_scripts'; type = 'edit' }, @{ key = 'd1'; type = 'edit' },
        @{ key = 'workers_r2'; type = 'edit' }, @{ key = 'zone'; type = 'read' },
        @{ key = 'workers_routes'; type = 'edit' }
    ) | ConvertTo-Json -Compress
    return "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=$([uri]::EscapeDataString($permissions))&accountId=$Account&zoneId=all&name=Cadrora%20setup"
}

function Reset-SetupTargetAnswers {
    $state = $script:SetupSession.State
    $directory = Split-Path $script:SetupSession.Path
    if (Test-Path -LiteralPath (Join-Path $directory 'github-state.json')) {
        Write-SetupNotice (Get-SetupText 'githubTargetChanged') 'Warning'
        return $false
    }
    # Once provisioning may have started, changing the target could abandon or
    # overwrite a real installation. Include pre-checkpoint legacy artifacts.
    if (($state.ContainsKey('deploymentStarted') -and $state.deploymentStarted) -or
        $state.steps.ContainsKey('deployment') -or $state.publication.Count -gt 0 -or
        (Test-Path -LiteralPath (Join-Path $directory 'manifest.json')) -or
        (Test-Path -LiteralPath (Join-Path $directory 'admin-credentials.env'))) {
        Write-SetupNotice (Get-SetupText 'editTargetLocked') 'Warning'
        return $false
    }
    # Drop cached private inputs first; a crash between files can only cause
    # reentry, never use an old account's keys with a newly edited target.
    $script:SetupSession.Secrets = @{}
    Write-SetupJson $script:SetupSession.SecretsPath @{}
    $language = Get-SetupAnswer 'language'
    $state.answers = @{}
    if ($language) { $state.answers.language = $language }
    $state.steps = @{}
    $state.currentStep = ''
    $state.approvedFingerprint = ''
    $state.secretRevision = ''
    Add-SetupEvent 'decision' 'target' 'reenter-before-deployment'
    Write-SetupNotice (Get-SetupText 'editTargetReady')
    return $true
}

function Invoke-SetupCloudCommand {
    param([string]$Step, [string]$Node, [string[]]$Arguments, [hashtable]$Cloud, [string]$Hostname)
    while ($true) {
        Set-SetupStep $Step 'running'
        if ($Step -eq 'deployment') {
            $script:SetupSession.State.deploymentStarted = $true
            Save-SetupProgress
        }
        try {
            Invoke-SetupCommand $Node $Arguments
            if ($Step -ne 'deployment') { Set-SetupStep $Step 'completed' 'live-preflight' }
            return $true
        } catch {
            Set-SetupStep $Step 'failed' 'command-failed'
            # The command wrapper shows its diagnostic log path. Never save raw errors.
            Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + (Get-SetupText 'cloudCommandFailed')) -Accent Yellow
        }
        while ($true) {
            $action = (Read-SetupPrompt (Get-SetupText 'cloudRecoveryAction') -Default 'retry' -DefaultLabel (Get-SetupText 'retryDefault')).ToLowerInvariant()
            if (-not $action) { $action = 'retry' }
            if ($action -notin @('retry', 'reessayer', 'done', 'fait', 'token', 'jeton', 'stop')) { continue }
            Add-SetupEvent 'decision' $Step $action
            if ($action -eq 'stop') { Write-SetupText (Get-SetupText 'paused'); return $false }
            if ($action -in @('token', 'jeton')) {
                if (-not (Read-SetupToken $Cloud)) { return $false }
            }
            # Recheck the target and credentials before repeating a write.
            foreach ($check in @('domain', 'r2', 'turnstile')) {
                $path = switch ($check) { 'domain' { 'domains/overview' } 'r2' { 'r2/overview' } default { 'turnstile' } }
                if (-not (Confirm-SetupCloudflareStep $check $Cloud $Hostname "https://dash.cloudflare.com/$($Cloud.Account)/$path" -AllowKeys:$false)) { return $false }
            }
            Set-SetupSecret 'CLOUDFLARE_API_TOKEN' $Cloud.Token
            break
        }
    }
}

function Test-SetupWebsite {
    param([string]$Hostname)
    if ($Hostname -cnotmatch '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$') { return $false }
    $protocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $protocol -bor [Net.SecurityProtocolType]::Tls12
        # /contact deliberately redirects to the configured language. Probe the
        # two built documents directly so normal localization is not a failure.
        foreach ($path in @('/', '/fr/contact/', '/en/contact/', '/admin/login')) {
            # Normal certificate validation, no redirects to a different site,
            # no cookies, admin password or Cloudflare token in these requests.
            $page = Invoke-WebRequest -Uri "https://$Hostname$path" -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 0 -Headers @{ 'Cache-Control' = 'no-cache' } -ErrorAction Stop
            if ($page.StatusCode -ne 200 -or $page.Headers['Content-Type'] -notmatch '^text/html' -or
                $page.Content -notmatch '<div\s+id=["'']root["'']') { return $false }
        }
        return $true
    } catch { return $false }
    finally { [Net.ServicePointManager]::SecurityProtocol = $protocol }
}

function Confirm-SetupWebsite {
    param([string]$Hostname)
    while ($true) {
        Set-SetupStep 'website' 'running'
        Write-SetupBlock (Get-SetupText 'websiteChecking')
        if (Test-SetupWebsite $Hostname) {
            Set-SetupStep 'website' 'completed' 'https-home-contact-login-html'
            return $true
        }
        Set-SetupStep 'website' 'failed' 'https-pages-unavailable'
        Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + (Get-SetupText 'websiteWaiting')) -Accent Yellow
        while ($true) {
            $action = (Read-SetupPrompt (Get-SetupText 'websiteAction') -Default 'retry' -DefaultLabel (Get-SetupText 'retryDefault')).ToLowerInvariant()
            if (-not $action) { $action = 'retry' }
            if ($action -notin @('retry', 'reessayer', 'done', 'fait', 'open', 'ouvrir', 'stop')) { continue }
            Add-SetupEvent 'decision' 'website' $action
            if ($action -eq 'stop') { Write-SetupText (Get-SetupText 'paused'); return $false }
            if ($action -in @('open', 'ouvrir')) { Open-SetupPage "https://$Hostname/"; continue }
            break
        }
    }
}

function Confirm-SetupFirstLogin {
    param([string]$Hostname, [string]$Directory, [string]$Evidence)
    if (Test-SetupCompleted 'first-login' $Evidence) { return $true }
    Set-SetupStep 'first-login' 'running'
    $credentialPath = Join-Path $Directory 'admin-credentials.env'
    Write-SetupBlock ((Get-SetupText 'firstLogin') -f $credentialPath)
    Open-SetupPage "https://$Hostname/admin/login"
    while ($true) {
        $action = (Read-SetupPrompt (Get-SetupText 'firstLoginAction') -Default 'done' -DefaultLabel (Get-SetupText 'signedInDefault')).ToLowerInvariant()
        if (-not $action) { $action = 'done' }
        if ($action -notin @('done', 'fait', 'open', 'ouvrir', 'password', 'motdepasse', 'stop')) { continue }
        Add-SetupEvent 'decision' 'first-login' $action
        switch ($action) {
            { $_ -in @('done', 'fait') } {
                if (-not (Confirm-SetupWebsite $Hostname)) { return $false }
                # This records the user's report, not an automated auth test.
                Set-SetupStep 'first-login' 'completed' $Evidence
                Add-SetupEvent 'verification' 'first-login' 'user-confirmed-dashboard'
                return $true
            }
            { $_ -in @('open', 'ouvrir') } { Open-SetupPage "https://$Hostname/admin/login" }
            { $_ -in @('password', 'motdepasse') } {
                try { Start-Process -FilePath 'notepad.exe' -ArgumentList ('"' + $credentialPath + '"') -WindowStyle Normal -ErrorAction Stop | Out-Null }
                catch { Write-SetupText ((Get-SetupText 'passwordOpenFailed') -f $credentialPath) }
            }
            'stop' { Write-SetupText (Get-SetupText 'paused'); return $false }
        }
    }
}
