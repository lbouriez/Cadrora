const instancePattern = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/u;
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;

export function instanceUsage(command = 'npm run deploy:instance --') {
  return `Usage: ${command} --instance <name> --hostname <domain-or-subdomain> --confirm\n`;
}

export function parseInstanceArguments(argumentsList) {
  const instanceIndex = argumentsList.indexOf('--instance');
  const hostnameIndex = argumentsList.indexOf('--hostname');
  const instance = instanceIndex >= 0 ? argumentsList[instanceIndex + 1]?.trim().toLowerCase() : undefined;
  const hostname = hostnameIndex >= 0 ? argumentsList[hostnameIndex + 1]?.trim().toLowerCase() : undefined;
  const valueIndexes = new Set([instanceIndex + 1, hostnameIndex + 1]);
  const known = new Set(['--instance', '--hostname', '--confirm']);
  const unknown = argumentsList.filter((argument, index) => !known.has(argument) && !valueIndexes.has(index));
  if (unknown.length > 0 || !instance || !hostname || !argumentsList.includes('--confirm')) {
    throw new Error(instanceUsage().trim());
  }
  if (!instancePattern.test(instance)) {
    throw new Error('Instance names use 1-30 lowercase letters, numbers, or internal hyphens.');
  }
  if (!hostnamePattern.test(hostname)) {
    throw new Error('Hostname must be an exact domain or subdomain without a scheme, port, path, or wildcard.');
  }
  return { hostname, instance };
}

export function instanceResourceNames(instance) {
  const prefix = `cadrora-${instance}`;
  return {
    database: prefix,
    faceIndex: `${prefix}-face-index`,
    mediaBucket: `${prefix}-media`,
    modelsBucket: `${prefix}-models`,
    worker: prefix,
  };
}

export function assertManifestTarget(manifest, target) {
  if (!manifest) return;
  if (manifest.instance !== target.instance || manifest.hostname !== target.hostname) {
    throw new Error(
      `Instance ${target.instance} is already recorded for ${String(manifest.hostname ?? 'an unknown hostname')}. Use the original hostname or a new instance name.`,
    );
  }
}

export function assertSiteTarget(profile, target, showcaseEnabled = false, profiles = [profile]) {
  if (showcaseEnabled) throw new Error('The public showcase must never be seeded by an isolated instance deployment.');
  if (profile.deployment && (target.instance !== profile.deployment.instance || target.hostname !== profile.deployment.hostname)) {
    throw new Error(`Site profile ${profile.id} may deploy only as ${profile.deployment.instance} on ${profile.deployment.hostname}.`);
  }
  if (profiles.some((candidate) => candidate.id !== profile.id && candidate.deployment?.instance === target.instance)) {
    throw new Error(`Instance ${target.instance} is reserved by another site profile.`);
  }
}

export function instanceWranglerConfig(baseConfig, names, databaseId, hostname) {
  const config = structuredClone(baseConfig);
  config.name = names.worker;
  delete config.env;
  config.routes = [{ custom_domain: true, pattern: hostname }];
  config.vars.DEMO_SHOWCASE_ENABLED = 'false';
  config.d1_databases[0] = {
    ...config.d1_databases[0],
    database_id: databaseId,
    database_name: names.database,
  };
  config.r2_buckets[0] = { ...config.r2_buckets[0], bucket_name: names.mediaBucket };
  config.r2_buckets[1] = { ...config.r2_buckets[1], bucket_name: names.modelsBucket };
  config.vectorize[0] = { ...config.vectorize[0], index_name: names.faceIndex };
  return config;
}

export function parseR2BucketNames(output) {
  return new Set([...output.matchAll(/^name:\s+([^\s]+)\s*$/gmu)].map((match) => match[1]));
}
