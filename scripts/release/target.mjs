import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const wranglerPath = 'node_modules/wrangler/bin/wrangler.js';

export function usage(command) {
  return `Usage: ${command} (--production | --env preview) --confirm\n`;
}

export function parseReleaseTarget(argumentsList) {
  const production = argumentsList.includes('--production');
  const environmentIndex = argumentsList.indexOf('--env');
  const environment = environmentIndex >= 0 ? argumentsList[environmentIndex + 1] : undefined;
  const known = new Set(['--production', '--env', '--confirm']);
  const unknown = argumentsList.filter((argument, index) => !known.has(argument) && index !== environmentIndex + 1);
  if (unknown.length > 0 || (environmentIndex >= 0 && !environment)) {
    throw new Error('Unsupported deployment option.');
  }
  if (production === Boolean(environment)) {
    throw new Error('Choose exactly one target: --production or --env preview.');
  }
  if (environment && environment !== 'preview') {
    throw new Error('Only the isolated preview environment is supported by this release path.');
  }
  if (!argumentsList.includes('--confirm')) {
    throw new Error('Remote migration/deployment requires an explicit --confirm.');
  }
  return production ? { cloudflareEnv: undefined, label: 'production', migrationArgs: ['--env='] } : {
    cloudflareEnv: 'preview',
    label: 'preview',
    migrationArgs: ['--env', 'preview'],
  };
}

export function runWrangler(argumentsList, environment = process.env) {
  if (!existsSync(wranglerPath)) throw new Error('Wrangler is not installed. Run npm ci first.');
  const result = spawnSync(process.execPath, [wranglerPath, ...argumentsList], { env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function runNpmBuild(cloudflareEnv) {
  const environment = { ...process.env, ...(cloudflareEnv ? { CLOUDFLARE_ENV: cloudflareEnv } : {}) };
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
