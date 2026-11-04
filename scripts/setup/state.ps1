# Durable installer state. Only validated public answers and redacted events belong here.
$script:SetupSession = $null

function ConvertTo-SetupMap {
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $map = @{}
        foreach ($property in $Value.PSObject.Properties) { $map[$property.Name] = ConvertTo-SetupMap $property.Value }
        return $map
    }
    if ($Value -is [array]) { return ,@($Value | ForEach-Object { ConvertTo-SetupMap $_ }) }
    return $Value
}

function Write-SetupJson {
    param([string]$Path, $Value)
    $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        $json = $Value | ConvertTo-Json -Depth 16
        # Flush before atomically replacing the previous complete document.
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
        $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        for ($attempt = 1; $attempt -le 8; $attempt++) {
            try {
                if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, "$Path.bak") }
                else { [IO.File]::Move($temporary, $Path) }
                return
            } catch {
                $cause = $_.Exception
                while ($cause.InnerException) { $cause = $cause.InnerException }
                $code = $cause.HResult -band 65535
                # These Windows errors leave both original names intact. Do not
                # retry 1176/1177: ReplaceFile may already have moved a file.
                if ($code -notin @(5, 32, 33, 1175) -or $attempt -eq 8) { throw }
                if ($attempt -eq 1) { Write-SetupNotice (Get-SetupText 'stateWriteRetry') 'Warning' }
                Start-Sleep -Milliseconds ([Math]::Min(250 * $attempt, 1000))
            }
        }
    } catch {
        # Keep even an ambiguous replacement's temporary file for recovery.
        # Never delete the destination or fall back to a non-atomic overwrite.
        if ($script:SetupSession) { $script:SetupSession.WriteFailed = $true }
        throw [IO.IOException]::new(((Get-SetupText 'stateWriteFailed') -f $Path, $temporary), $_.Exception)
    }
}

function Save-SetupProgress {
    if (-not $script:SetupSession) { return }
    $script:SetupSession.State.updatedAt = [DateTime]::UtcNow.ToString('o')
    Write-SetupJson $script:SetupSession.Path $script:SetupSession.State
}

function Add-SetupEvent {
    param([string]$Kind, [string]$Name, [string]$Value)
    if (-not $script:SetupSession) { return }
    $state = $script:SetupSession.State
    $event = @{ at = [DateTime]::UtcNow.ToString('o'); kind = $Kind; name = $Name; value = $Value }
    $state.history = @(@($state.history) + $event | Select-Object -Last 1000)
    Save-SetupProgress
}

function Set-SetupAnswer {
    param([string]$Name, [string]$Value)
    if (-not $script:SetupSession) { return }
    if ($Name -notin @('hostname', 'accountId', 'siteKey', 'language', 'githubRepository', 'githubBranch', 'githubEnvironment', 'profile', 'profilePendingId', 'profileName', 'profileLanguage', 'profileCreated')) { throw 'Unsupported public setup answer.' }
    $answers = $script:SetupSession.State.answers
    if ($Name -in @('hostname', 'accountId', 'githubRepository', 'githubBranch', 'githubEnvironment', 'profile') -and $answers.ContainsKey($Name) -and $answers[$Name] -ne $Value) {
        throw (Get-SetupText 'targetChanged')
    }
    $answers[$Name] = $Value
    Add-SetupEvent 'answer' $Name $Value
}

function Get-SetupAnswer {
    param([string]$Name)
    if ($script:SetupSession -and $script:SetupSession.State.answers.ContainsKey($Name)) {
        return [string]$script:SetupSession.State.answers[$Name]
    }
    return ''
}

function Set-SetupStep {
    param([string]$Name, [ValidateSet('running', 'completed', 'failed', 'stopped', 'interrupted', 'pending')][string]$Status,
        [string]$Evidence = '')
    if (-not $script:SetupSession) { return }
    $state = $script:SetupSession.State
    $attempts = 0
    if ($state.steps.ContainsKey($Name)) { $attempts = $state.steps[$Name].attempts }
    if ($Status -eq 'running') { $attempts++ }
    $state.currentStep = $Name
    $state.steps[$Name] = @{ status = $Status; attempts = $attempts; checkedAt = [DateTime]::UtcNow.ToString('o'); evidence = $Evidence }
    Add-SetupEvent 'step' $Name $Status
}

function Test-SetupCompleted {
    param([string]$Name, [string]$Evidence)
    if (-not $script:SetupSession -or -not $script:SetupSession.State.steps.ContainsKey($Name)) { return $false }
    $step = $script:SetupSession.State.steps[$Name]
    return $step.status -eq 'completed' -and $step.evidence -eq $Evidence
}

function Save-SetupPrivateValue {
    param([string]$Name, [Security.SecureString]$Value)
    if (-not $script:SetupSession) { return }
    if ($Name -notin @('token', 'turnstile')) { throw 'Unsupported setup secret.' }
    # No key parameter: Windows DPAPI binds ciphertext to this Windows identity.
    $script:SetupSession.Secrets[$Name] = ConvertFrom-SecureString -SecureString $Value
    Write-SetupJson $script:SetupSession.SecretsPath $script:SetupSession.Secrets
    if ($Name -eq 'turnstile') { $script:SetupSession.State.secretRevision = [guid]::NewGuid().ToString('N') }
    Add-SetupEvent 'secret' $Name 'stored-with-windows-dpapi'
}

function Restore-SetupPrivateValue {
    param([string]$Name)
    if (-not $script:SetupSession -or -not $script:SetupSession.Secrets.ContainsKey($Name)) { return $null }
    try { return ConvertTo-SecureString $script:SetupSession.Secrets[$Name] -ErrorAction Stop }
    catch {
        Write-SetupNotice (Get-SetupText 'secretUnavailable') 'Warning'
        Add-SetupEvent 'secret' $Name 'unavailable-reenter-required'
        return $null
    }
}

function Get-SetupPrivateRevision {
    # Include the actual encrypted value in the release fingerprint. A process
    # can stop between saving the private store and saving progress.json.
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($script:SetupSession.Secrets.turnstile)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally { $sha.Dispose() }
}

function Assert-SetupState {
    param([hashtable]$State, [string]$Instance)
    if ($State.schemaVersion -ne 1 -or $State.instance -ne $Instance -or $State.answers -isnot [hashtable] -or
        $State.steps -isnot [hashtable] -or $State.history -isnot [array] -or -not $State.ContainsKey('secretRevision') -or
        -not $State.ContainsKey('currentStep')) { throw (Get-SetupText 'stateInvalid') }
    $patterns = @{ hostname = '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$';
        accountId = '^[a-f0-9]{32}$'; siteKey = '^[A-Za-z0-9_-]{10,100}$'; language = '^(en|fr)$';
        githubRepository = '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'; githubBranch = '^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$';
        githubEnvironment = '^[a-z0-9][a-z0-9-]{0,60}$'; profile = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
        profilePendingId = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
        profileName = '^[^\r\n\x00-\x1f]{1,80}$'; profileLanguage = '^(fr|en)$'; profileCreated = '^(true|false)$' }
    foreach ($key in $State.answers.Keys) {
        if (-not $patterns.ContainsKey($key) -or $State.answers[$key] -cnotmatch $patterns[$key]) { throw (Get-SetupText 'stateInvalid') }
    }
    foreach ($step in $State.steps.Values) {
        # ConvertFrom-Json uses Int32 in Windows PowerShell and Int64 in PS7.
        if ($step.status -notin @('running', 'completed', 'failed', 'stopped', 'interrupted', 'pending') -or
            ($step.attempts -isnot [int] -and $step.attempts -isnot [long]) -or
            $step.attempts -lt 0 -or $step.evidence -isnot [string]) { throw (Get-SetupText 'stateInvalid') }
    }
}

function Start-SetupSession {
    param([string]$Directory, [string]$Instance)
    Protect-SetupDirectory $Directory
    # The build output and node_modules are shared by every instance in this checkout.
    $lockPath = Join-Path (Split-Path (Split-Path $Directory)) 'setup.lock'
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw (Get-SetupText 'alreadyRunning') }
    try {
        $path = Join-Path $Directory 'progress.json'
        $state = @{ schemaVersion = 1; instance = $Instance; answers = @{}; steps = @{}; history = @(); currentStep = ''; secretRevision = ''; approvedFingerprint = ''; publication = @{} }
        if (Test-Path -LiteralPath $path) {
            try {
                $state = ConvertTo-SetupMap (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
                Assert-SetupState $state $Instance
            } catch { throw (Get-SetupText 'stateInvalid') }
            Write-SetupBlock ((Get-SetupText 'resume') -f $state.currentStep, $path)
        } else {
            $legacyPath = Join-Path $Directory 'setup.json'
            if (Test-Path -LiteralPath $legacyPath) {
                $legacy = Get-Content -LiteralPath $legacyPath -Raw -Encoding UTF8 | ConvertFrom-Json
                foreach ($name in @('hostname', 'accountId', 'siteKey')) {
                    if ($legacy.PSObject.Properties.Name -contains $name) { $state.answers[$name] = $legacy.$name }
                }
                Assert-SetupState $state $Instance
            }
        }
        if (-not $state.ContainsKey('approvedFingerprint')) { $state.approvedFingerprint = '' }
        if (-not $state.ContainsKey('publication')) { $state.publication = @{} }
        $secretsPath = Join-Path $Directory 'secrets.dpapi.json'
        $secrets = @{}
        if (Test-Path -LiteralPath $secretsPath) {
            try {
                $secrets = ConvertTo-SetupMap (Get-Content -LiteralPath $secretsPath -Raw -Encoding UTF8 | ConvertFrom-Json)
                if ($secrets -isnot [hashtable]) { throw 'Invalid encrypted store' }
            } catch { Write-SetupText (Get-SetupText 'secretUnavailable'); $secrets = @{} }
        }
        $script:SetupSession = @{ State = $state; Path = $path; SecretsPath = $secretsPath; Secrets = $secrets; Lock = $lock }
        foreach ($name in @($state.steps.Keys)) {
            if ($state.steps[$name].status -eq 'running') { Set-SetupStep $name 'interrupted' 'previous-process-ended' }
        }
        Save-SetupProgress
    } catch { $lock.Dispose(); $script:SetupSession = $null; throw }
}

function Stop-SetupSession {
    if (-not $script:SetupSession) { return }
    try {
        $state = $script:SetupSession.State
        if (-not $script:SetupSession.ContainsKey('WriteFailed') -and $state.currentStep -and $state.steps[$state.currentStep].status -eq 'running') {
            Set-SetupStep $state.currentStep 'stopped' 'user-stopped'
        }
    } finally { $script:SetupSession.Lock.Dispose(); $script:SetupSession = $null }
}

function Get-SetupSourceFingerprint {
    param([string]$Root)
    $files = @(Get-ChildItem -LiteralPath $Root -File | Where-Object { $_.Extension -in @('.json', '.jsonc', '.ts', '.js', '.mjs', '.html', '.ps1') })
    foreach ($folder in @('src', 'scripts', 'tests', 'migrations', 'sites', 'public')) {
        $path = Join-Path $Root $folder
        if (Test-Path -LiteralPath $path) {
            $files += @(Get-ChildItem -LiteralPath $path -File -Recurse | Where-Object { $_.FullName -notmatch '[\\/]public[\\/]brand[\\/]responsive[\\/]' })
        }
    }
    $files += @(Get-ChildItem -LiteralPath $Root -File -Force -Filter '.env*')
    foreach ($name in @('.dev.vars')) {
        $path = Join-Path $Root $name
        if (Test-Path -LiteralPath $path) { $files += Get-Item -LiteralPath $path }
    }
    $lines = foreach ($file in $files | Sort-Object FullName) {
        $relative = $file.FullName.Substring($Root.TrimEnd('\', '/').Length).Replace('\', '/')
        "$relative=$((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash)"
    }
    # Public build/feature overrides and Node execution options also invalidate
    # cached validation. Only the combined digest is persisted, never values.
    # Windows PowerShell normalizes an empty environment value to absence.
    $lines += @(Get-ChildItem Env: | Where-Object { $_.Value -and $_.Name -match '^(VITE_|FEATURE_|NODE_OPTIONS$|NODE_ENV$)' } |
        Sort-Object Name | ForEach-Object { "environment:$($_.Name)=$($_.Value)" })
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Invoke-SetupRecordedCommand {
    param([string]$Step, [string]$Evidence, [string]$Command, [string[]]$Arguments, [switch]$Always)
    if (-not $Always -and (Test-SetupCompleted $Step $Evidence)) {
        Write-SetupNotice ((Get-SetupText 'reusedStep') -f $Step) 'Success'
        return
    }
    Set-SetupStep $Step 'running' $Evidence
    Invoke-SetupCommand $Command $Arguments
    Set-SetupStep $Step 'completed' $Evidence
}
