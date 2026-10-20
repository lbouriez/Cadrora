import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { featureFlagVars } from '../config/featureFlags.mjs';
import { loadSiteProfile, profileWorkerVars } from '../sites/loadProfile.mjs';

const generatedConfigPath = '.cadrora.remote.wrangler.json';

async function restrictSecretsDirectory(directory) {
  if (process.platform !== 'win32') {
    await chmod(directory, 0o700);
    return;
  }

  // Windows ignores POSIX permission bits. Protect the empty directory before
  // writing secrets, with inheritable access only for the deploying identity.
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot) throw new Error('SystemRoot is required to secure release secrets on Windows.');
  execFileSync(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `
      $ErrorActionPreference = 'Stop'
      $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl = New-Object System.Security.AccessControl.DirectorySecurity
      $acl.SetOwner($identity)
      $acl.SetAccessRuleProtection($true, $false)
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
      $acl.AddAccessRule($rule)
      Set-Acl -LiteralPath $env:CADRORA_RELEASE_SECRETS_DIRECTORY -AclObject $acl
    `,
  ], {
    // Pass the path as data, and do not give the ACL subprocess the build secrets.
    env: { SystemRoot: systemRoot, CADRORA_RELEASE_SECRETS_DIRECTORY: directory },
    stdio: 'pipe',
  });
}

function requiredEnvironment(name, environment) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Create/select the Cloudflare resource, then set this build variable before a remote release.`);
  return value;
}

function remoteResourceNames(target) {
  return target.cloudflareEnv === 'preview'
    ? {
        d1Id: 'CADRORA_PREVIEW_D1_DATABASE_ID',
        mediaBucket: 'CADRORA_PREVIEW_MEDIA_BUCKET_NAME',
        modelsBucket: 'CADRORA_PREVIEW_MODELS_BUCKET_NAME',
      }
    : {
        d1Id: 'CADRORA_D1_DATABASE_ID',
        mediaBucket: 'CADRORA_MEDIA_BUCKET_NAME',
        modelsBucket: 'CADRORA_MODELS_BUCKET_NAME',
      };
}

function targetConfig(config, target) {
  return target.cloudflareEnv ? config.env?.[target.cloudflareEnv] : config;
}

export async function prepareRemoteConfig(target, environment = process.env) {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  const selectedConfig = targetConfig(config, target);
  if (!selectedConfig?.d1_databases?.[0] || !selectedConfig?.r2_buckets?.[0] || !selectedConfig?.r2_buckets?.[1]) {
    throw new Error(`The ${target.label} environment has incomplete Cloudflare resource bindings.`);
  }

  const names = remoteResourceNames(target);
  selectedConfig.d1_databases[0].database_id = requiredEnvironment(names.d1Id, environment);
  selectedConfig.r2_buckets[0].bucket_name = requiredEnvironment(names.mediaBucket, environment);
  selectedConfig.r2_buckets[1].bucket_name = requiredEnvironment(names.modelsBucket, environment);
  selectedConfig.vars.DEMO_SHOWCASE_ENABLED = environment.CADRORA_SEED_DEMO?.trim().toLowerCase() === 'true'
    ? 'true'
    : 'false';
  Object.assign(selectedConfig.vars, profileWorkerVars(loadSiteProfile('cadrora')));
  selectedConfig.vars = featureFlagVars(selectedConfig.vars, environment);
  await writeFile(generatedConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return {
    configPath: generatedConfigPath,
    async cleanup() {
      await rm(generatedConfigPath, { force: true });
    },
  };
}

export async function prepareRemoteSecrets(environment = process.env) {
  const adminHash = requiredEnvironment('ADMIN_SECRET_HASH', environment);
  const authPepper = requiredEnvironment('AUTH_PEPPER', environment);
  const turnstileSecret = requiredEnvironment('TURNSTILE_SECRET_KEY', environment);
  const directory = await mkdtemp(join(resolve(tmpdir()), 'cadrora-release-'));
  const secretsPath = join(directory, 'secrets.env');
  // The directory is created by this invocation; never remove a pre-existing
  // checkout path or another release's temporary file.
  const cleanup = () => rm(directory, { recursive: true, force: true });

  try {
    await restrictSecretsDirectory(directory);
    await writeFile(
      secretsPath,
      `ADMIN_SECRET_HASH=${JSON.stringify(adminHash)}\nAUTH_PEPPER=${JSON.stringify(authPepper)}\nTURNSTILE_SECRET_KEY=${JSON.stringify(turnstileSecret)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    return { secretsPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
