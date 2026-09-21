import { parseReleaseTarget, runNpmBuild, runWrangler, usage } from './target.mjs';
import { prepareRemoteConfig, prepareRemoteSecrets } from './remoteConfig.mjs';
import { seedDemoContent } from '../demo/seed.mjs';

const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  process.stdout.write(usage('npm run release:deploy --'));
  process.stdout.write('This command builds the selected Cloudflare environment, applies DB-bound remote migrations, then deploys.\n');
  process.exit(0);
}

try {
  const target = parseReleaseTarget(argumentsList);
  const remoteConfig = await prepareRemoteConfig(target);
  let remoteSecrets;
  try {
    process.stdout.write(`Building ${target.label}; secret values are never printed.\n`);
    runNpmBuild(target.cloudflareEnv);
    process.stdout.write(`Applying D1 migrations to ${target.label} through the DB binding.\n`);
    runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', remoteConfig.configPath, ...target.migrationArgs]);
    await seedDemoContent(target, remoteConfig.configPath);
    remoteSecrets = await prepareRemoteSecrets();
    process.stdout.write(`Deploying ${target.label}.\n`);
    runWrangler(['deploy', '--config', remoteConfig.configPath, '--secrets-file', remoteSecrets.secretsPath, ...target.migrationArgs]);
  } finally {
    await remoteSecrets?.cleanup();
    await remoteConfig.cleanup();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Release failed before deployment.'}\n`);
  process.exit(2);
}
