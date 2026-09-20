import { parseReleaseTarget, runNpmBuild, runWrangler, usage } from './target.mjs';

const argumentsList = process.argv.slice(2);
if (argumentsList.includes('--help')) {
  process.stdout.write(usage('npm run release:deploy --'));
  process.stdout.write('This command builds the selected Cloudflare environment, applies DB-bound remote migrations, then deploys.\n');
  process.exit(0);
}

try {
  const target = parseReleaseTarget(argumentsList);
  process.stdout.write(`Building ${target.label}; no secrets are read or printed by this script.\n`);
  runNpmBuild(target.cloudflareEnv);
  process.stdout.write(`Applying D1 migrations to ${target.label} through the DB binding.\n`);
  runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote', ...target.migrationArgs]);
  process.stdout.write(`Deploying ${target.label}.\n`);
  runWrangler(['deploy']);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Release failed before deployment.'}\n`);
  process.exit(2);
}
