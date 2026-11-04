# Windows PowerShell 5.1 and PowerShell 7. No module installation required.
. (Join-Path $PSScriptRoot 'ui.ps1')
. (Join-Path $PSScriptRoot 'state.ps1')
. (Join-Path $PSScriptRoot 'journey.ps1')
. (Join-Path $PSScriptRoot 'github.ps1')
$script:SetupNode = ''
function Get-SetupText {
    param([string]$Key)
    if ($script:SetupText.PSObject.Properties.Name -contains $Key) { return $script:SetupText.$Key }
    # Keep GitHub guidance separate without changing the shared FR/EN lookup.
    $language = $script:SetupText.languageCode
    $githubText = Get-Content -LiteralPath (Join-Path $PSScriptRoot "messages.github.$language.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($githubText.PSObject.Properties.Name -contains $Key) { return $githubText.$Key }
    return ''
}

function Read-SetupValue {
    param([string]$Key, [string]$Pattern, [string]$Default = '')
    while ($true) {
        $prompt = Get-SetupText $Key
        $value = Read-SetupPrompt $prompt -Default $Default
        if ($Key -eq 'confirm') { $value = $value.ToUpperInvariant() }
        if ($Key -in @('instance', 'hostname')) { $value = $value.ToLowerInvariant() }
        if ($value -cmatch $Pattern) {
            if ($Key -in @('hostname', 'siteKey')) { Set-SetupAnswer $Key $value }
            if ($Key -eq 'confirm') { Add-SetupEvent 'decision' 'deploy-confirmation' $value }
            return $value
        }
        Write-SetupNotice (Get-SetupText 'invalid') 'Warning'
    }
}

function Invoke-SetupCommand {
    param([string]$Command, [string[]]$Arguments)
    $directory = Split-Path $script:SetupSession.Path
    $log = Join-Path $directory ('logs/' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.log')
    $node = if ([IO.Path]::GetFileName($Command) -ieq 'npm.cmd') { Join-Path (Split-Path $Command) 'node.exe' }
        elseif ($script:SetupNode) { $script:SetupNode } else { $Command }
    Write-SetupText ((Get-SetupText 'commandLog') -f $log)
    # Only this helper's fixed ASCII status codes reach PowerShell. Native UTF-8
    # stdout/stderr go directly to a redacted log, avoiding PS 5.1 decoding errors.
    & $node (Join-Path $PSScriptRoot 'runLogged.mjs') $log $directory $Command @Arguments | ForEach-Object {
        switch -Exact ($_) {
            'active' { Write-SetupNotice (Get-SetupText 'commandActive') }
            'resources' { Write-SetupNotice (Get-SetupText 'progressResources') }
            'build' { Write-SetupNotice (Get-SetupText 'progressBuild') }
            'database' { Write-SetupNotice (Get-SetupText 'progressDatabase') }
            'models' { Write-SetupNotice (Get-SetupText 'progressModels') }
            'publish' { Write-SetupNotice (Get-SetupText 'progressPublish') }
            'log-error' { Write-SetupNotice (Get-SetupText 'commandLogFailed') 'Warning' }
        }
    }
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-SetupNotice ((Get-SetupText 'commandLogFailure') -f $log) 'Warning'
        $failure = [Exception]::new(((Get-SetupText 'commandFailed') -f $log, $exitCode))
        $failure.Data['ExitCode'] = $exitCode
        throw $failure
    }
    Write-SetupNotice (Get-SetupText 'commandComplete') 'Success'
}

function Get-NodeMinimums {
    param([string]$Root)
    $engine = (Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).engines.node
    # Fail closed if the repository changes to a range this bootstrap cannot interpret.
    if ($engine -notmatch '^\^\d+\.\d+\.\d+( \|\| \^\d+\.\d+\.\d+)*$') { throw (Get-SetupText 'engineRange') }
    @($engine.Split('|') | Where-Object { $_.Trim() } | ForEach-Object { [version]$_.Trim().TrimStart('^') })
}

function Test-SetupNode {
    param([string]$Node, [version[]]$Minimums)
    try {
        $output = & $Node --version 2>$null
        if ($LASTEXITCODE -ne 0 -or $output -notmatch '^v\d+\.\d+\.\d+$') { return $false }
        $version = [version]$output.TrimStart('v')
        return @($Minimums | Where-Object { $_.Major -eq $version.Major -and $version -ge $_ }).Count -gt 0
    } catch { return $false }
}

function Find-SetupNode {
    param([string]$Root, [version[]]$Minimums)
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode -and (Test-SetupNode $systemNode.Source $Minimums)) {
        $npm = Join-Path (Split-Path $systemNode.Source) 'npm.cmd'
        if (Test-SetupNpm $npm) { return $systemNode.Source }
    }
    $tools = Join-Path $Root '.artifacts/tools'
    if (Test-Path -LiteralPath $tools) {
        foreach ($directory in Get-ChildItem -LiteralPath $tools -Directory -Filter 'node-v*-win-*') {
            $node = Join-Path $directory.FullName 'node.exe'
            if ((Test-SetupNpm (Join-Path $directory.FullName 'npm.cmd')) -and (Test-SetupNode $node $Minimums)) { return $node }
        }
    }
    return $null
}

function Test-SetupNpm {
    param([string]$Npm)
    try {
        if (-not (Test-Path -LiteralPath $Npm)) { return $false }
        $version = & $Npm --version 2>$null
        return $LASTEXITCODE -eq 0 -and [version]$version -ge [version]'10.0.0'
    } catch { return $false }
}

function Install-SetupNode {
    param([string]$Root, [version[]]$Minimums)
    $version = ($Minimums | Sort-Object -Descending | Select-Object -First 1).ToString()
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $architecture = switch ($architecture) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { throw (Get-SetupText 'architecture') } }
    $name = "node-v$version-win-$architecture"
    $tools = Join-Path $Root '.artifacts/tools'
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $archive = Join-Path $tools "$name.zip"
    $base = "https://nodejs.org/dist/v$version"
    # TLS 1.2 is needed by stock Windows PowerShell 5.1 on some Windows installs.
    $oldProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $oldProtocol -bor [Net.SecurityProtocolType]::Tls12
        $sums = (Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content
        $match = [regex]::Match($sums, "(?m)^([a-f0-9]{64})\s+" + [regex]::Escape("$name.zip") + '\r?$')
        if (-not $match.Success) { throw (Get-SetupText 'checksum') }
        Invoke-WebRequest "$base/$name.zip" -OutFile $archive -UseBasicParsing
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $match.Groups[1].Value) {
            throw (Get-SetupText 'checksum')
        }
        Expand-Archive -LiteralPath $archive -DestinationPath $tools -Force
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $oldProtocol
        if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
    }
    $node = Join-Path $tools "$name/node.exe"
    if (-not (Test-SetupNode $node $Minimums)) { throw (Get-SetupText 'nodeFailed') }
    return $node
}

function Protect-SetupDirectory {
    param([string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    # Persist only the modified access rules. Set-Acl can also attempt to write
    # audit settings, requiring SeSecurityPrivilege even for a user-owned folder.
    # Leave ownership and auditing untouched; no elevated privileges are needed.
    $directory = Get-Item -LiteralPath $Path
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $directory.SetAccessControl($acl)
    } else {
        [System.IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
    }
}

function Set-SetupSecret {
    param([string]$Name, [Security.SecureString]$Value)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Environment]::SetEnvironmentVariable($Name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), 'Process') }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Open-SetupPage {
    param([string]$Url)
    # Only Cloudflare and fixed pages on this saved installation may be opened.
    $address = [uri]$Url
    $site = Get-SetupAnswer 'hostname'
    $ownPage = $site -and $address.Host -eq $site -and $address.AbsolutePath -in @('/', '/admin/login') -and -not $address.Query -and -not $address.Fragment
    if ($address.Scheme -ne 'https' -or (-not $ownPage -and $address.Host -ne 'dash.cloudflare.com') -or $address.UserInfo -or -not $address.IsDefaultPort) {
        throw (Get-SetupText 'unsafePage')
    }
    # This is the user's interactive browser step, so the window must be visible.
    try {
        Start-Process -FilePath $Url -WindowStyle Normal -ErrorAction Stop | Out-Null
        Write-SetupNotice ((Get-SetupText 'browserOpened') -f $address.GetLeftPart([UriPartial]::Path))
    } catch {
        Write-SetupNotice (Get-SetupText 'openFailed') 'Warning'
        # Keep the full fallback URL copyable, including its token-template query.
        Write-Host $Url -ForegroundColor Cyan
    }
}

function Wait-SetupBrowserStep {
    param([string]$Text, [string]$Url)
    Write-SetupBlock $Text
    Open-SetupPage $Url
    while ($true) {
        $answer = (Read-SetupPrompt (Get-SetupText 'stepAction') -Default 'done' -DefaultLabel (Get-SetupText 'continueDefault')).ToLowerInvariant()
        if ($answer -in @('done', 'fait', 'ok', 'open', 'ouvrir', 'stop', 'quit', 'quitter')) {
            Add-SetupEvent 'decision' 'browser' $answer
        }
        switch ($answer) {
            { $_ -in @('done', 'fait', 'ok') } { return $true }
            { $_ -in @('open', 'ouvrir') } { Open-SetupPage $Url }
            { $_ -in @('stop', 'quit', 'quitter') } { Write-SetupText (Get-SetupText 'paused'); return $false }
            default { Write-SetupNotice (Get-SetupText 'stepHelp') 'Warning' }
        }
    }
}

function Read-SetupAccount {
    param([string]$Default = '')
    while ($true) {
        $value = Read-SetupValue 'account' '.+' $Default
        if ($value.ToLowerInvariant() -in @('stop', 'quit', 'quitter')) {
            Add-SetupEvent 'decision' 'account' 'stop'
            Write-SetupText (Get-SetupText 'paused'); return $null
        }
        if ($value.ToLowerInvariant() -in @('open', 'ouvrir')) {
            Add-SetupEvent 'decision' 'account' 'open'
            Open-SetupPage 'https://dash.cloudflare.com/'; continue
        }
        if ($value -cmatch '^[a-f0-9]{32}$') { Set-SetupAnswer 'accountId' $value; return $value }
        $address = $null
        if ([uri]::TryCreate($value, [UriKind]::Absolute, [ref]$address) -and $address.Scheme -eq 'https' -and
            $address.Host -eq 'dash.cloudflare.com' -and -not $address.UserInfo -and
            $address.AbsolutePath -cmatch '^/([a-f0-9]{32})(?:/|$)') {
            Set-SetupAnswer 'accountId' $Matches[1]; return $Matches[1]
        }
        Write-SetupNotice (Get-SetupText 'accountHelp') 'Warning'
    }
}

function Read-SetupPrivateValue {
    param([string]$Key, [switch]$RejectTestKey, [string]$BrowserUrl = '')
    while ($true) {
        $value = Read-SetupPrompt (Get-SetupText $Key) -AsSecureString
        if ($value.Length -eq 0) { $value.Dispose(); Write-SetupText (Get-SetupText 'emptySecret'); continue }
        if ($BrowserUrl) {
            # Only record recognized navigation commands, never the pasted key.
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
            try {
                $navigation = switch ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim().ToLowerInvariant()) {
                    { $_ -in @('open', 'ouvrir') } { 'open' }
                    { $_ -in @('stop', 'quit', 'quitter') } { 'stop' }
                    default { '' }
                }
            } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
            if ($navigation) {
                $value.Dispose()
                Add-SetupEvent 'decision' $Key $navigation
                if ($navigation -eq 'stop') { Write-SetupText (Get-SetupText 'paused'); return $null }
                Open-SetupPage $BrowserUrl; continue
            }
        }
        if ($RejectTestKey) {
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
            try { $isTestKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -match '^[123]x00000000000000000000' }
            finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
            if ($isTestKey) { $value.Dispose(); Write-SetupText (Get-SetupText 'testKeys'); continue }
        }
        Save-SetupPrivateValue $Key $value
        return $value
    }
}

function Invoke-SetupCloudflareRead {
    param([string]$Path, [Security.SecureString]$Token)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token)
    $protocol = [Net.ServicePointManager]::SecurityProtocol
    $headers = @{}
    try {
        [Net.ServicePointManager]::SecurityProtocol = $protocol -bor [Net.SecurityProtocolType]::Tls12
        $headers.Authorization = 'Bearer ' + [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        # GET only. Do not print provider exceptions: they can contain request details.
        $body = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/$Path" -Method Get -Headers $headers -TimeoutSec 20 -ErrorAction Stop
        if ($body.success -ne $true) { return @{ ok = $false; message = 'providerUnavailable' } }
        return @{ ok = $true; result = $body.result }
    } catch {
        $status = 0
        if ($_.Exception.PSObject.Properties.Name -contains 'Response' -and $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        $message = if ($status -in @(401, 403)) { 'tokenRejected' } else { 'providerUnavailable' }
        return @{ ok = $false; message = $message }
    } finally {
        $headers.Clear()
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        [Net.ServicePointManager]::SecurityProtocol = $protocol
    }
}

function Test-SetupCloudflareStep {
    param([ValidateSet('domain', 'r2', 'turnstile')][string]$Step, [hashtable]$Cloud, [string]$Hostname)
    if ($Step -eq 'turnstile') {
        if (-not $Cloud.SiteKey -or -not $Cloud.Turnstile) { return @{ ok = $false; message = 'turnstileMissing' } }
        $response = Invoke-SetupCloudflareRead "accounts/$($Cloud.Account)/challenges/widgets/$($Cloud.SiteKey)" $Cloud.Token
        if (-not $response.ok) { return $response }
        $widget = $response.result
        if ($null -eq $widget -or @('sitekey', 'secret', 'domains', 'mode', 'clearance_level' | Where-Object { $widget.PSObject.Properties.Name -notcontains $_ }).Count) {
            return @{ ok = $false; message = 'providerUnavailable' }
        }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Cloud.Turnstile)
        try { $sameSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) -ceq $widget.secret }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        if (-not $sameSecret -or $widget.sitekey -cne $Cloud.SiteKey -or $widget.mode -ne 'managed' -or
            $widget.clearance_level -ne 'no_clearance' -or $widget.domains -isnot [array] -or $widget.domains -notcontains $Hostname) {
            return @{ ok = $false; message = 'turnstileMismatch' }
        }
        return @{ ok = $true }
    }
    if ($Step -eq 'r2') {
        $response = Invoke-SetupCloudflareRead "accounts/$($Cloud.Account)/r2/buckets" $Cloud.Token
        if (-not $response.ok) { return $response }
        if ($null -eq $response.result -or $response.result.PSObject.Properties.Name -notcontains 'buckets' -or $response.result.buckets -isnot [array]) {
            return @{ ok = $false; message = 'providerUnavailable' }
        }
        return @{ ok = $true }
    }
    $parts = $Hostname.Split('.')
    for ($offset = 0; $offset -lt $parts.Length - 1; $offset++) {
        $zoneName = $parts[$offset..($parts.Length - 1)] -join '.'
        $response = Invoke-SetupCloudflareRead "zones?account.id=$($Cloud.Account)&name=$zoneName&match=all" $Cloud.Token
        if (-not $response.ok) { return $response }
        if ($response.result -isnot [array]) { return @{ ok = $false; message = 'providerUnavailable' } }
        foreach ($zone in $response.result) {
            if ($null -eq $zone -or $zone.PSObject.Properties.Name -notcontains 'name' -or
                $zone.PSObject.Properties.Name -notcontains 'account' -or $zone.PSObject.Properties.Name -notcontains 'status' -or
                $null -eq $zone.account -or $zone.account.PSObject.Properties.Name -notcontains 'id') {
                return @{ ok = $false; message = 'providerUnavailable' }
            }
            if ($zone.name -eq $zoneName -and $zone.account.id -eq $Cloud.Account) {
                if ($zone.status -ne 'active') { return @{ ok = $false; message = 'domainPending' } }
                return @{ ok = $true }
            }
        }
    }
    return @{ ok = $false; message = 'domainMissing' }
}

function Read-SetupToken {
    param([hashtable]$Cloud)
    Set-SetupStep 'token' 'running'
    Write-SetupBlock (Get-SetupText 'tokenStep')
    $url = Get-SetupTokenUrl $Cloud.Account
    Open-SetupPage $url
    $replacement = Read-SetupPrivateValue 'token' -BrowserUrl $url
    if (-not $replacement) { return $false }
    if ($Cloud.Token) { $Cloud.Token.Dispose() }
    $Cloud.Token = $replacement
    return $true
}

function Read-SetupTurnstile {
    param([hashtable]$Cloud, [string]$Hostname, [string]$Instance)
    Set-SetupStep 'turnstile' 'running'
    if (-not (Wait-SetupBrowserStep ((Get-SetupText 'turnstileStep') -f $Hostname, $Instance) "https://dash.cloudflare.com/$($Cloud.Account)/turnstile")) { return $false }
    while ($true) {
        $Cloud.SiteKey = Read-SetupValue 'siteKey' '^[A-Za-z0-9_-]{10,100}$' (Get-SetupAnswer 'siteKey')
        if ($Cloud.SiteKey -notmatch '^[123]x00000000000000000000') { break }
        Write-SetupText (Get-SetupText 'testKeys')
    }
    $replacement = Read-SetupPrivateValue 'turnstile' -RejectTestKey
    if ($Cloud.Turnstile) { $Cloud.Turnstile.Dispose() }
    $Cloud.Turnstile = $replacement
    return $true
}

function Confirm-SetupCloudflareStep {
    param([string]$Step, [hashtable]$Cloud, [string]$Hostname, [string]$Url, [bool]$AllowKeys = $true)
    while ($true) {
        Set-SetupStep $Step 'running'
        Write-SetupText (Get-SetupText 'verifying')
        $result = Test-SetupCloudflareStep $Step $Cloud $Hostname
        if ($result.ok) {
            Set-SetupStep $Step 'completed' 'cloudflare-read'
            if ($Step -eq 'domain') {
                Set-SetupStep 'account' 'completed' 'zone-belongs-to-account'
                Set-SetupStep 'token' 'completed' 'live-api-authorization'
            }
            Write-SetupNotice (Get-SetupText 'verified') 'Success'; return $true
        }
        Set-SetupStep $Step 'failed' $result.message
        Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + (Get-SetupText $result.message)) -Accent Yellow
        $tokenRejected = $result.message -eq 'tokenRejected'
        $recoveryUrl = $Url
        if ($tokenRejected) {
            $recoveryUrl = Get-SetupTokenUrl $Cloud.Account
            if ($Step -eq 'turnstile') { Write-SetupText (Get-SetupText 'turnstileTokenHelp') }
        } elseif ($Step -eq 'r2') { Write-SetupText (Get-SetupText 'r2Help') }
        $promptKey = if ($tokenRejected) { 'tokenRecoveryAction' } elseif ($Step -eq 'turnstile' -and $AllowKeys) { 'retryKeysAction' } else { 'retryAction' }
        Write-SetupBlock (Get-SetupText $promptKey)
        while ($true) {
            $answer = (Read-SetupPrompt (Get-SetupText 'recoveryChoice') -Default '1').ToLowerInvariant()
            $choices = if ($tokenRejected) {
                @{ '1' = 'token'; '2' = 'retry'; '0' = 'stop' }
            } else {
                @{ '1' = 'retry'; '2' = 'open'; '3' = 'token'; '4' = 'edit'; '0' = 'stop' }
            }
            if (-not $tokenRejected -and $Step -eq 'turnstile' -and $AllowKeys) { $choices['5'] = 'keys' }
            if ($choices.ContainsKey($answer)) { $answer = $choices[$answer] }
            if ($answer -in @('done', 'fait', 'retry', 'reessayer', 'ok', 'open', 'ouvrir', 'token', 'jeton', 'keys', 'cles', 'edit', 'modifier', 'stop', 'quit', 'quitter')) {
                Add-SetupEvent 'decision' $Step $answer
            }
            if ($answer -in @('done', 'fait', 'retry', 'reessayer', 'ok')) { break }
            if ($answer -in @('open', 'ouvrir')) { Open-SetupPage $recoveryUrl; continue }
            if ($answer -in @('token', 'jeton')) {
                if (-not (Read-SetupToken $Cloud)) { return $false }
                break
            }
            if ($Step -eq 'turnstile' -and $AllowKeys -and $answer -in @('keys', 'cles')) {
                if (-not (Read-SetupTurnstile $Cloud $Hostname $script:SetupSession.State.instance)) { return $false }
                break
            }
            if ($answer -in @('edit', 'modifier')) {
                if (Reset-SetupTargetAnswers) { Write-SetupText (Get-SetupText 'editTargetRestart'); return $false }
                continue
            }
            if ($answer -in @('stop', 'quit', 'quitter')) { Write-SetupText (Get-SetupText 'paused'); return $false }
            Write-SetupNotice (Get-SetupText 'recoveryInvalid') 'Warning'
        }
    }
}

function Get-SetupDependencyEvidence {
    param([string]$Root, [string]$Npm, [string]$Node)
    $lockPath = Join-Path $Root 'node_modules/.package-lock.json'
    if (-not (Test-Path -LiteralPath $lockPath) -or -not (Test-Path -LiteralPath (Join-Path $Root 'node_modules/wrangler/bin/wrangler.js'))) { return '' }
    try {
        & $Node (Join-Path $Root 'scripts/setup/verifyDependencies.mjs') $Root | Out-Null
        if ($LASTEXITCODE -ne 0) { return '' }
        & $Npm ls --depth=0 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { return '' }
    } catch { return '' }
    $lockHash = (Get-FileHash -LiteralPath (Join-Path $Root 'package-lock.json') -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash
    $nodeVersion = & $Node --version
    return "$lockHash|$installedHash|$nodeVersion"
}

function Confirm-SetupDependencies {
    param([string]$Root, [string]$Npm, [string]$Node)
    while ($true) {
        Set-SetupStep 'dependencies' 'running'
        $evidence = Get-SetupDependencyEvidence $Root $Npm $Node
        if ($evidence) {
            Set-SetupStep 'dependencies' 'completed' $evidence
            Write-SetupNotice (Get-SetupText 'dependenciesReady') 'Success'
            return $evidence
        }
        try {
            Invoke-SetupCommand $Npm @('ci')
            $evidence = Get-SetupDependencyEvidence $Root $Npm $Node
            if (-not $evidence) { throw (Get-SetupText 'dependenciesInvalid') }
            Set-SetupStep 'dependencies' 'completed' $evidence
            return $evidence
        } catch {
            $failure = $_.Exception
            while ($failure.InnerException -and -not $failure.Data.Contains('ExitCode')) { $failure = $failure.InnerException }
            $locked = $failure.Data.Contains('ExitCode') -and $failure.Data['ExitCode'] -in @(-4082, -4048)
            $message = if ($locked) { 'dependenciesLocked' } else { 'dependenciesFailed' }
            Set-SetupStep 'dependencies' 'failed' $message
            Write-SetupBlock ((Get-SetupText $message) -f $Root) -Accent Yellow
        }
        while ($true) {
            $action = (Read-SetupPrompt (Get-SetupText 'dependenciesAction') -Default '1').ToLowerInvariant()
            if ($action -in @('1', 'retry', 'reessayer', 'done', 'fait')) {
                Add-SetupEvent 'decision' 'dependencies' 'retry'; break
            }
            if ($action -in @('0', 'stop', 'quit', 'quitter')) {
                Add-SetupEvent 'decision' 'dependencies' 'stop'
                Write-SetupText (Get-SetupText 'paused'); return ''
            }
            Write-SetupNotice (Get-SetupText 'recoveryInvalid') 'Warning'
        }
    }
}

function Get-SetupDeploymentProof {
    param([hashtable]$Cloud, [string]$Hostname, [string]$Instance)
    $prefix = "accounts/$($Cloud.Account)/workers"
    $deployment = Invoke-SetupCloudflareRead "$prefix/scripts/cadrora-$Instance/deployments" $Cloud.Token
    if (-not $deployment.ok) { return '' }
    try {
        $latest = $deployment.result.deployments[0]
        if ($latest.id -cnotmatch '^[a-f0-9-]{36}$') { return '' }
        $domains = Invoke-SetupCloudflareRead "$prefix/domains?hostname=$Hostname&service=cadrora-$Instance" $Cloud.Token
        if (-not $domains.ok -or $domains.result -isnot [array]) { return '' }
        foreach ($domain in $domains.result) {
            if ($domain.hostname -eq $Hostname -and $domain.service -eq "cadrora-$Instance" -and $domain.enabled -eq $true -and
                $domain.id -is [string] -and -not [string]::IsNullOrWhiteSpace($domain.id)) {
                # Cloudflare defines domain IDs as opaque strings, not UUIDs.
                return "$($latest.id)|$($domain.id)"
            }
        }
    } catch { return '' }
    return ''
}

function Get-SetupReleaseEvidence {
    param([string]$Fingerprint, [string]$Directory)
    $credentialFile = Join-Path $Directory 'admin-credentials.env'
    $hash = if (Test-Path -LiteralPath $credentialFile) { (Get-FileHash -LiteralPath $credentialFile -Algorithm SHA256).Hash } else { 'no-local-credentials' }
    return "$Fingerprint|$hash"
}

function Invoke-CadroraSetup {
    param([string]$Root, [string]$Language, [switch]$Diagnose, [switch]$UseSavedLanguage, [switch]$EditAnswers, [switch]$ReplaceToken, [switch]$Preview, [switch]$Local)
    $script:SetupText = Get-Content -LiteralPath (Join-Path $Root "scripts/setup/messages.$Language.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Preview) { Show-SetupPreview; return }
    if ($env:OS -ne 'Windows_NT') { throw (Get-SetupText 'windowsOnly') }
    $minimums = Get-NodeMinimums $Root
    $node = Find-SetupNode $Root $minimums
    if ($Diagnose) {
        Write-SetupBlock (Get-SetupText 'title')
        Write-SetupText ((Get-SetupText 'nodeStatus') -f $(if ($node) { $node } else { Get-SetupText 'willInstall' }))
        foreach ($tool in @('git', 'gh')) {
            $toolPath = Find-SetupGitHubTool $tool
            Write-SetupText ((Get-SetupText 'githubToolStatus') -f $tool, $(if ($toolPath) { $toolPath } else { Get-SetupText 'willInstall' }))
        }
        Write-SetupText ((Get-SetupText 'wranglerStatus') -f (Test-Path -LiteralPath (Join-Path $Root 'node_modules/wrangler/bin/wrangler.js')))
        Write-SetupText (Get-SetupText 'diagnoseDone')
        return
    }

    Write-SetupBlock ((Get-SetupText 'title') + "`n" + (Get-SetupText 'welcome'))
    $savedInstances = @()
    $instancesPath = Join-Path $Root '.artifacts/instances'
    if (Test-Path -LiteralPath $instancesPath) {
        $savedInstances = @(Get-ChildItem -LiteralPath $instancesPath -Directory | Where-Object {
            $_.Name -cmatch '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'progress.json'))
        })
    }
    $defaultInstance = if ($savedInstances.Count -eq 1) { $savedInstances[0].Name } else { '' }
    $instance = Read-SetupValue 'instance' '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$' $defaultInstance
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $Root 'sites') -Filter profile.json -Recurse) {
        $profile = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
        if ($profile.PSObject.Properties.Name -contains 'deployment' -and $profile.deployment.PSObject.Properties.Name -contains 'instance') {
            if ($profile.id -in @('cadrora', 'atelier-giulia') -and $profile.deployment.instance -eq $instance) { throw (Get-SetupText 'reserved') }
        }
    }
    $directory = Join-Path $Root ".artifacts/instances/$instance"
    Start-SetupSession $directory $instance
    $cloud = @{ Account = ''; Token = $null; SiteKey = ''; Turnstile = $null }
    try {
        if ($UseSavedLanguage -and (Get-SetupAnswer 'language')) {
            $Language = Get-SetupAnswer 'language'
            $script:SetupText = Get-Content -LiteralPath (Join-Path $Root "scripts/setup/messages.$Language.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        Set-SetupAnswer 'language' $Language
        if ($EditAnswers -and -not (Reset-SetupTargetAnswers)) { return }
        # Old local publications retain their recovery path. New installations
        # always use the user's fork and Actions unless -Local is explicit.
        $useGitHub = -not $Local -and ((Get-SetupAnswer 'githubRepository') -or $script:SetupSession.State.publication.Count -eq 0)
        if ($useGitHub) {
            if (-not $node) { $node = Install-SetupNode $Root $minimums }
            if (-not (Confirm-SetupGitHubProfile $Root $node $instance)) { return }
        }
        $hostname = Get-SetupAnswer 'hostname'
        if (-not $hostname) {
            Set-SetupStep 'hostname' 'running'
            $hostname = Read-SetupValue 'hostname' '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
        }
        Set-SetupStep 'hostname' 'completed' 'validated-exact-hostname'
        $cloud.Account = Get-SetupAnswer 'accountId'
        if (-not $cloud.Account) {
            Set-SetupStep 'account' 'running'
            Write-SetupBlock (Get-SetupText 'accountStep')
            Open-SetupPage 'https://dash.cloudflare.com/'
            $cloud.Account = Read-SetupAccount
            if (-not $cloud.Account) { return }
        }
        $account = $cloud.Account
        Write-SetupBlock ((Get-SetupText 'savedTarget') -f $hostname, $account)
        Write-SetupText (Get-SetupText 'recoveryHint')
        $domainUrl = "https://dash.cloudflare.com/$account/domains/overview"
        $cloud.Token = Restore-SetupPrivateValue 'token'
        if (-not $cloud.Token -or $ReplaceToken) {
            if (-not (Test-SetupCompleted 'domain-guide' 'user-confirmed')) {
                Set-SetupStep 'domain-guide' 'running'
                if (-not (Wait-SetupBrowserStep ((Get-SetupText 'domainStep') -f $hostname) $domainUrl)) { return }
                Set-SetupStep 'domain-guide' 'completed' 'user-confirmed'
            }
            if (-not (Read-SetupToken $cloud)) { return }
        }
        # These checks are deliberately live on every invocation, even for completed steps.
        if (-not (Confirm-SetupCloudflareStep 'domain' $cloud $hostname $domainUrl)) { return }
        $r2Url = "https://dash.cloudflare.com/$account/r2/overview"
        Set-SetupStep 'r2' 'running'
        if (-not (Test-SetupCloudflareStep 'r2' $cloud $hostname).ok) {
            if (-not (Wait-SetupBrowserStep (Get-SetupText 'r2Step') $r2Url)) { return }
        }
        if (-not (Confirm-SetupCloudflareStep 'r2' $cloud $hostname $r2Url)) { return }
        $cloud.SiteKey = Get-SetupAnswer 'siteKey'
        $cloud.Turnstile = Restore-SetupPrivateValue 'turnstile'
        if (-not $cloud.SiteKey -or -not $cloud.Turnstile) {
            if (-not (Read-SetupTurnstile $cloud $hostname $instance)) { return }
        }
        if (-not (Confirm-SetupCloudflareStep 'turnstile' $cloud $hostname "https://dash.cloudflare.com/$account/turnstile")) { return }
        Write-SetupText (Get-SetupText 'turnstileCollected')
        if ($useGitHub) {
            Invoke-SetupGitHubPublication $Root $node $cloud $instance $hostname | Out-Null
            return
        }
        $publication = $script:SetupSession.State.publication
        if ($publication.ContainsKey('fingerprint') -and $publication.fingerprint -and -not $publication.proof) {
            # A successful publication was checkpointed before proof discovery
            # failed. Finish that release first, even if the installer changed.
            # Keep proof empty until HTTPS and the user's sign-in are complete,
            # so stopping either check resumes here without another deployment.
            Write-SetupBlock (Get-SetupText 'resumePublished')
            Set-SetupStep 'deployment' 'running'
            $proof = Get-SetupDeploymentProof $cloud $hostname $instance
            if (-not $proof) { throw (Get-SetupText 'deploymentUnverified') }
            Set-SetupStep 'deployment' 'completed' 'current-worker-deployment-and-custom-domain'
            if (-not (Confirm-SetupWebsite $hostname)) { return }
            if (-not (Confirm-SetupFirstLogin $hostname $directory "$($publication.fingerprint)|$proof")) { return }
            $publication.proof = $proof
            Save-SetupProgress
            Write-SetupBlock ((Get-SetupText 'done') -f $hostname, (Join-Path $directory 'admin-credentials.env')) -Accent Green
            return
        }
        $siteKey = $cloud.SiteKey
        $source = Get-SetupSourceFingerprint $Root
        $approvalFingerprint = "$source|$siteKey|$($script:SetupSession.State.secretRevision)|$(Get-SetupPrivateRevision)"
        if ($script:SetupSession.State.approvedFingerprint -ne $approvalFingerprint) {
            Set-SetupStep 'approval' 'running'
            Write-SetupBlock ((Get-SetupText 'summary') -f $hostname, $account, $instance)
            if ((Read-SetupValue 'confirm' '^(DEPLOY|STOP)$' 'DEPLOY') -ne 'DEPLOY') { return }
            $script:SetupSession.State.approvedFingerprint = $approvalFingerprint
            Set-SetupStep 'approval' 'completed' $approvalFingerprint
        }

        $names = @('PATH', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'CLOUDFLARE_ENV', 'ADMIN_SECRET_HASH', 'AUTH_PEPPER', 'TURNSTILE_SECRET_KEY', 'VITE_TURNSTILE_SITE_KEY', 'VITE_APP_NAME', 'VITE_PHOTOGRAPHER_NAME', 'VITE_SITE_DEFAULT_LANG', 'CADRORA_SITE', 'CADRORA_SEED_DEMO', 'CADRORA_D1_LOCATION', 'CI', 'GITHUB_ACTIONS')
        $saved = @{}
        foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
        Push-Location $Root
        try {
            foreach ($name in $names | Where-Object { $_ -ne 'PATH' }) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
            Set-SetupStep 'tools' 'running'
            Write-SetupBlock (Get-SetupText 'installing')
            if (-not $node) { $node = Install-SetupNode $Root $minimums }
            $env:PATH = "$(Split-Path $node);$env:PATH"
            $npm = Join-Path (Split-Path $node) 'npm.cmd'
            if (-not (Test-SetupNpm $npm)) { throw (Get-SetupText 'npmVersion') }
            Set-SetupStep 'tools' 'completed' 'supported-node-and-npm'
            $dependencies = Confirm-SetupDependencies $Root $npm $node
            if (-not $dependencies) { return }
            $fingerprint = "$approvalFingerprint|$dependencies"
            Write-SetupBlock (Get-SetupText 'checking')
            Invoke-SetupRecordedCommand 'check' $fingerprint $npm @('run', 'check')
            Invoke-SetupRecordedCommand 'tests' $fingerprint $npm @('run', 'test', '--', '--maxWorkers=2')
            $env:CLOUDFLARE_ACCOUNT_ID = $account
            $env:VITE_TURNSTILE_SITE_KEY = $siteKey
            $env:CADRORA_SITE = 'studio'
            $env:CADRORA_SEED_DEMO = 'false'
            Set-SetupSecret 'CLOUDFLARE_API_TOKEN' $cloud.Token
            Set-SetupSecret 'TURNSTILE_SECRET_KEY' $cloud.Turnstile
            Write-SetupBlock (Get-SetupText 'preflight')
            if (-not (Invoke-SetupCloudCommand 'preflight' $node @('scripts/setup/instancePreflight.mjs', '--instance', $instance, '--hostname', $hostname, '--confirm') $cloud $hostname)) { return }
            $release = Get-SetupReleaseEvidence $fingerprint $directory
            $publication = $script:SetupSession.State.publication
            $publish = -not ($publication.ContainsKey('fingerprint') -and $publication.fingerprint -eq $release)
            Set-SetupStep 'deployment' 'running'
            if (-not $publish) {
                $proof = Get-SetupDeploymentProof $cloud $hostname $instance
                if (-not $proof) { throw (Get-SetupText 'deploymentUnverified') }
                if ($publication.proof -and $publication.proof -ne $proof) {
                    Write-SetupBlock ((Get-SetupText 'attentionTitle') + "`n" + (Get-SetupText 'deploymentChanged')) -Accent Yellow
                    if ((Read-SetupValue 'confirm' '^(DEPLOY|STOP)$' 'DEPLOY') -ne 'DEPLOY') { return }
                    $publish = $true
                }
            }
            if ($publish) {
                Write-SetupBlock (Get-SetupText 'deploying')
                if (-not (Invoke-SetupCloudCommand 'deployment' $node @('scripts/instances/deploy.mjs', '--instance', $instance, '--hostname', $hostname, '--confirm') $cloud $hostname)) { return }
                $release = Get-SetupReleaseEvidence $fingerprint $directory
                $script:SetupSession.State.publication = @{ fingerprint = $release; proof = '' }
                Save-SetupProgress
                $proof = Get-SetupDeploymentProof $cloud $hostname $instance
                if (-not $proof) { throw (Get-SetupText 'deploymentUnverified') }
            }
            $script:SetupSession.State.publication.proof = $proof
            Set-SetupStep 'deployment' 'completed' 'current-worker-deployment-and-custom-domain'
            if (-not (Confirm-SetupWebsite $hostname)) { return }
            if (-not (Confirm-SetupFirstLogin $hostname $directory "$release|$proof")) { return }
            Write-SetupBlock ((Get-SetupText 'done') -f $hostname, (Join-Path $directory 'admin-credentials.env')) -Accent Green
        } finally {
            foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
            Pop-Location
        }
    } catch {
        if (-not $script:SetupSession.ContainsKey('WriteFailed') -and $script:SetupSession.State.currentStep) {
            Set-SetupStep $script:SetupSession.State.currentStep 'failed' 'operation-failed-see-terminal'
        }
        throw
    } finally {
        if ($cloud.Token) { $cloud.Token.Dispose() }
        if ($cloud.Turnstile) { $cloud.Turnstile.Dispose() }
        Stop-SetupSession
    }
}
