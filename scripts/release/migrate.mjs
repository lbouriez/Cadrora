import { parseReleaseTarget, runWrangler, usage } from './target.mjs';
import { prepareRemoteConfig } from './remoteConfig.mjs';

const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  process.stdout.write(usage('npm run release:migrate --'));
  process.exit(0);
}

try {
  const target = parseReleaseTarget(argumentsList);
  const remoteConfig = await prepareRemoteConfig(target);
  try {
    process.stdout.write(`Applying D1 migrations to ${target.label} through the DB binding.\n`);
    runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', remoteConfig.configPath, ...target.migrationArgs]);
  } finally {
    await remoteConfig.cleanup();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unable to select a release target.'}\n`);
  process.exit(2);
}
