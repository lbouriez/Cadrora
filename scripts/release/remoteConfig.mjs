import { readFile, rm, writeFile } from 'node:fs/promises';

const generatedConfigPath = '.cadrora.remote.wrangler.json';
const generatedSecretsPath = '.cadrora.remote.secrets.env';

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
  const turnstileSecret = requiredEnvironment('TURNSTILE_SECRET_KEY', environment);
  await writeFile(
    generatedSecretsPath,
    `ADMIN_SECRET_HASH=${JSON.stringify(adminHash)}\nTURNSTILE_SECRET_KEY=${JSON.stringify(turnstileSecret)}\n`,
    'utf8',
  );

  return {
    secretsPath: generatedSecretsPath,
    async cleanup() {
      await rm(generatedSecretsPath, { force: true });
    },
  };
}
