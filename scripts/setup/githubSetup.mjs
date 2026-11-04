import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { availableProfiles, createStudioProfile, profileFiles } from './siteProfile.mjs';
import { readDeployments, validateDeployment, workflowFile } from './deploymentConfig.mjs';
import { validateSavedCredentials } from './instancePreflight.mjs';
import { assertSiteTarget } from '../instances/instanceConfig.mjs';
import { listSiteProfiles, loadSiteProfile } from '../sites/loadProfile.mjs';
import { githubFailure } from './githubDiagnostics.mjs';

export function writePublicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}

export function githubRepository(remote) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/u.exec(remote.trim());
  if (!match || match[1].toLowerCase() === 'lbouriez/cadrora') throw new Error('githubForkRequired');
  return match[1];
}

export function nativeRunner(command, args, options) {
  const result = spawnSync(command, args, { cwd: options.root, encoding: 'utf8', windowsHide: true,
    input: options.input, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_DEBUG: '', GIT_TERMINAL_PROMPT: '0' } });
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '', errorCode: result.error?.code };
}

export function createGitHubSetup({ root, directory, run = nativeRunner, env = process.env, now = Date.now }) {
  const ghPath = env.CADRORA_GH_EXE || 'gh';
  const gitPath = env.CADRORA_GIT_EXE || 'git';
  const statePath = join(directory, 'github-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  const save = () => writePublicJson(statePath, state);
  function command(executable, args, input, failure = 'githubCommandFailed') {
    const result = run(executable, args, { root, input });
    if (result.code !== 0) {
      const verb = args[0] === '-c' ? 'commit' : args[0];
      const operation = executable === gitPath ? `git.${verb}` : executable === ghPath ? `github.${verb}` : 'credentials.generate';
      throw githubFailure({ result, operation, directory, environment: { ...process.env, ...env }, fallback: failure });
    }
    return result.stdout.trim();
  }
  const git = (...args) => command(gitPath, args, undefined, 'githubGitFailed');
  const gh = (...args) => command(ghPath, args);
  function api(path, method = 'GET', body, optional = false) {
    const args = ['api', '--hostname', 'github.com', '--method', method, path];
    if (body !== undefined) args.push('--input', '-');
    const result = run(ghPath, args, { root, input: body === undefined ? undefined : JSON.stringify(body) });
    if (result.code !== 0) {
      if (optional && /HTTP 404/u.test(result.stderr)) return null;
      throw githubFailure({ result, operation: `github.api.${method}`, directory, environment: { ...process.env, ...env } });
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) : null;
  }
  function inspect() {
    const checkout = resolve(git('rev-parse', '--show-toplevel'));
    const expected = resolve(root);
    if ((process.platform === 'win32' ? checkout.toLowerCase() !== expected.toLowerCase() : checkout !== expected)) throw new Error('githubCheckoutRequired');
    const repository = githubRepository(git('remote', 'get-url', 'origin'));
    const info = JSON.parse(gh('repo', 'view', repository, '--json', 'nameWithOwner,isFork,viewerPermission,defaultBranchRef'));
    if (!info.isFork || info.nameWithOwner.toLowerCase() !== repository.toLowerCase()) throw new Error('githubForkRequired');
    if (info.viewerPermission !== 'ADMIN') throw new Error('githubPermissions');
    const branch = git('branch', '--show-current');
    git('check-ref-format', '--branch', branch);
    if (!branch) throw new Error('githubCheckoutRequired');
    return { repository: info.nameWithOwner, branch, profiles: availableProfiles(root) };
  }
  function bind(config) {
    config = validateDeployment(config);
    const current = inspect();
    if (current.repository !== config.repository || current.branch !== config.branch) throw new Error('githubTargetChanged');
    const identity = JSON.stringify(config);
    if (state.identity && state.identity !== identity) throw new Error('githubTargetChanged');
    state.identity = identity;
    assertSiteTarget(loadSiteProfile(config.profile, root), { instance: config.instance, hostname: config.hostname }, false, listSiteProfiles(root));
    save();
  }
  function prepare(config) {
    config = validateDeployment(config);
    bind(config);
    for (const old of readDeployments(root)) {
      if (old.instance === config.instance && JSON.stringify(old) !== JSON.stringify(config)) throw new Error('githubTargetChanged');
      if (old.instance !== config.instance && (old.environment === config.environment || old.hostname === config.hostname)) throw new Error('githubConfigConflict');
    }
    const relative = `.cadrora/deployments/${config.instance}.json`;
    writePublicJson(join(root, relative), config);
    return { config, files: [relative, ...profileFiles(root, config.profile)] };
  }
  function desiredVariables(config) {
    const desired = { CADRORA_SITE: config.profile, CADRORA_INSTANCE: config.instance, CADRORA_HOSTNAME: config.hostname,
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, VITE_TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY };
    if (!/^[a-f0-9]{32}$/u.test(desired.CLOUDFLARE_ACCOUNT_ID ?? '') || !/^[A-Za-z0-9_-]{10,100}$/u.test(desired.VITE_TURNSTILE_SITE_KEY ?? '')
      || !env.CLOUDFLARE_API_TOKEN || !env.TURNSTILE_SECRET_KEY) throw new Error('githubSecretsMissing');
    return desired;
  }
  function credentialSettings(config) {
    const path = join(directory, 'admin-credentials.env');
    if (!existsSync(path)) throw new Error('githubCredentialsMissing');
    const content = readFileSync(path, 'utf8');
    validateSavedCredentials(content);
    const credentials = Object.fromEntries(content.split(/\r?\n/u).filter((line) => /^[A-Z_]+=/u.test(line)).map((line) => {
      const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
    }));
    const desired = desiredVariables(config);
    const secrets = { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, ADMIN_SECRET_HASH: credentials.ADMIN_SECRET_HASH,
      AUTH_PEPPER: credentials.AUTH_PEPPER, TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY };
    return { desired, secrets, signature: createHash('sha256').update(JSON.stringify({ desired, secrets })).digest('hex') };
  }
  function settings(config) {
    config = validateDeployment(config);
    if (state.identity !== JSON.stringify(config)) throw new Error('githubTargetChanged');
    const { signature } = credentialSettings(config);
    return { changed: signature !== state.secretSignature || Boolean(state.refreshRequired) };
  }
  function configure(config) {
    config = validateDeployment(config);
    bind(config);
    const base = `repos/${config.repository}`;
    const environmentPath = `${base}/environments/${config.environment}`;
    const existing = api(environmentPath, 'GET', undefined, true);
    if (!existing) api(environmentPath, 'PUT', { deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } });
    const variables = api(`${environmentPath}/variables?per_page=100`).variables;
    const secretList = api(`${environmentPath}/secrets?per_page=100`).secrets;
    const oldVariables = Object.fromEntries(variables.map((item) => [item.name, item.value]));
    const desired = desiredVariables(config);
    for (const key of ['CADRORA_SITE', 'CADRORA_INSTANCE', 'CADRORA_HOSTNAME', 'CLOUDFLARE_ACCOUNT_ID']) {
      if (oldVariables[key] && oldVariables[key] !== desired[key]) throw new Error('githubTargetChanged');
    }
    if (secretList.length && !oldVariables.CADRORA_INSTANCE) throw new Error('githubEnvironmentInUse');
    const credentialsPath = join(directory, 'admin-credentials.env');
    if (!existsSync(credentialsPath)) {
      if (secretList.some((item) => ['ADMIN_SECRET_HASH', 'AUTH_PEPPER'].includes(item.name))) throw new Error('githubCredentialsMissing');
      command(process.execPath, ['scripts/setup/adminCredentials.mjs', '--output', credentialsPath]);
    }
    const { secrets, signature } = credentialSettings(config);
    // Read-only secret metadata is all GitHub exposes. Never fetch or print values.
    const secretDates = Object.fromEntries(secretList.filter((item) => Object.hasOwn(secrets, item.name)).sort((a, b) => a.name.localeCompare(b.name)).map((item) => [item.name, item.updated_at]));
    if (state.secretSignature === signature && state.configuringSignature !== signature && state.secretDates
      && JSON.stringify(state.secretDates) !== JSON.stringify(secretDates)) throw new Error('githubSecretsChanged');
    const policy = existing?.deployment_branch_policy;
    if (policy?.protected_branches) {
      const branch = api(`${base}/branches/${encodeURIComponent(config.branch)}`);
      if (!branch.protected) throw new Error('githubBranchPolicy');
    } else if (!existing || policy?.custom_branch_policies) {
      const policies = api(`${environmentPath}/deployment-branch-policies?per_page=100`).branch_policies;
      if (!policies.some((item) => item.name === config.branch && item.type !== 'tag')) api(`${environmentPath}/deployment-branch-policies`, 'POST', { name: config.branch, type: 'branch' });
    }
    // Persist intent before the first variable/secret write. A restart after
    // partial configuration still knows that a new publication is required.
    if (state.pushedCommit && state.secretSignature !== signature) state.refreshRequired = true;
    state.configuringSignature = signature; save();
    for (const [name, value] of Object.entries(desired)) {
      if (oldVariables[name] !== value) gh('variable', 'set', name, '--repo', config.repository, '--env', config.environment, '--body', value);
    }
    if (state.secretSignature !== signature || Object.keys(secrets).some((name) => !secretDates[name])) {
      for (const [name, value] of Object.entries(secrets)) command(ghPath, ['secret', 'set', name, '--repo', config.repository, '--env', config.environment], value);
    }
    const checkedVariables = api(`${environmentPath}/variables?per_page=100`).variables;
    const checkedSecrets = api(`${environmentPath}/secrets?per_page=100`).secrets;
    if (Object.entries(desired).some(([name, value]) => !checkedVariables.some((item) => item.name === name && item.value === value))
      || Object.keys(secrets).some((name) => !checkedSecrets.some((item) => item.name === name))) throw new Error('githubSettingsUnverified');
    state.secretSignature = signature;
    state.secretDates = Object.fromEntries(checkedSecrets.filter((item) => Object.hasOwn(secrets, item.name)).sort((a, b) => a.name.localeCompare(b.name)).map((item) => [item.name, item.updated_at]));
    delete state.configuringSignature;
    save();
    const permissions = api(`${base}/actions/permissions`);
    if (!permissions.enabled) api(`${base}/actions/permissions`, 'PUT', { enabled: true });
    gh('variable', 'set', 'CADRORA_DEPLOY_ENABLED', '--repo', config.repository, '--body', 'true');
    return { configured: true };
  }
  function remoteHead(config) {
    const value = git('ls-remote', `https://github.com/${config.repository}.git`, `refs/heads/${config.branch}`).split(/\s/u)[0];
    if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error('githubRemoteChanged');
    return value;
  }
  function publish(config) {
    config = validateDeployment(config);
    bind(config);
    if (!state.secretSignature) throw new Error('githubSecretsMissing');
    const scope = [`.cadrora/deployments/${config.instance}.json`, `sites/${config.profile}`];
    const files = [scope[0], ...profileFiles(root, config.profile)];
    const inScope = (file) => file === scope[0] || file.startsWith(`${scope[1]}/`);
    if (files.some((file) => /(?:^|\/)\.|\.(?:env|pem|key)$/iu.test(file.replace(/^\.cadrora\//u, 'cadrora/')))) throw new Error('githubUnsafeFiles');
    const changed = [...git('diff', '--name-only', 'HEAD', '-z').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean);
    if (changed.some((file) => !inScope(file))) throw new Error('githubUnrelatedChanges');
    const head = git('rev-parse', 'HEAD');
    const remote = remoteHead(config);
    const marker = `Cadrora-Setup: ${config.environment}`;
    if (!state.baseCommit) {
      if (head !== remote) throw new Error('githubRemoteChanged');
      state.baseCommit = head; save();
    }
    if (!state.commit && head !== state.baseCommit) {
      // Recover the small crash window between git commit and writing its checkpoint.
      if (git('rev-parse', 'HEAD^') !== state.baseCommit || !git('log', '-1', '--format=%B').split('\n').includes(marker)
        || git('diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-z', '-r', 'HEAD').split('\0').filter(Boolean).some((file) => !inScope(file))) throw new Error('githubRemoteChanged');
      state.commit = head; save();
    }
    if (state.commit && head !== state.commit) throw new Error('githubRemoteChanged');
    if (remote !== state.baseCommit && remote !== state.commit) throw new Error('githubRemoteChanged');
    if (state.commit && changed.length) throw new Error('githubFilesChanged');
    if (!state.commit) {
      if (changed.length) {
        git('add', '-A', '--', ...scope);
        const user = api('user');
        if (!/^[A-Za-z0-9-]+$/u.test(user.login) || !Number.isSafeInteger(user.id)) throw new Error('githubPermissions');
        git('-c', `user.name=${user.login}`, '-c', `user.email=${user.id}+${user.login}@users.noreply.github.com`,
          'commit', '--only', '-m', `Set up ${config.instance}\n\n${marker}`, '--', ...scope);
      }
      state.commit = git('rev-parse', 'HEAD'); save();
    }
    api(`repos/${config.repository}/actions/workflows/${workflowFile}/enable`, 'PUT');
    if (remote !== state.commit) {
      state.pushExpected = true; save();
      git('push', `https://github.com/${config.repository}.git`, `${state.commit}:refs/heads/${config.branch}`);
    }
    if (remoteHead(config) !== state.commit) throw new Error('githubRemoteChanged');
    state.pushedCommit = state.commit; save();
    return status(config, !state.pushExpected);
  }
  function status(config, dispatch = false) {
    config = validateDeployment(config);
    if (state.identity !== JSON.stringify(config)) throw new Error('githubTargetChanged');
    if (!state.commit) throw new Error('githubCommitMissing');
    const base = `repos/${config.repository}/actions`;
    if (!state.runId) {
      const runs = api(`${base}/workflows/${workflowFile}/runs?head_sha=${state.commit}&branch=${encodeURIComponent(config.branch)}&per_page=100`).workflow_runs;
      const matching = runs.filter((item) => item.head_sha === state.commit && item.head_branch === config.branch && ['push', 'workflow_dispatch'].includes(item.event));
      const selected = matching.find((item) => item.status !== 'completed') || matching.find((item) => item.conclusion === 'success') || matching[0];
      if (selected) { state.runId = selected.id; save(); }
      else if (dispatch && !state.dispatchRequested) {
        // Save before sending: a timeout must not automatically submit twice.
        state.dispatchRequested = true; save();
        api(`${base}/workflows/${workflowFile}/dispatches`, 'POST', { ref: config.branch, inputs: { environment: config.environment } });
      }
    }
    if (!state.runId) return { status: 'queued', commit: state.commit, url: `https://github.com/${config.repository}/actions` };
    if (!Number.isSafeInteger(state.runId)) throw new Error('githubRunInvalid');
    const result = api(`${base}/runs/${state.runId}`);
    if (result.head_sha !== state.commit || result.head_branch !== config.branch) throw new Error('githubRunInvalid');
    if (state.expectedRunAttempt && result.run_attempt < state.expectedRunAttempt) {
      const waiting = now() - (state.rerunRequestedAt ?? 0) < 120_000 || result.status !== 'completed';
      return { status: waiting ? 'queued' : 'completed', conclusion: waiting ? '' : 'rerun-unconfirmed',
        runAttempt: result.run_attempt, commit: state.commit, runId: state.runId,
        url: `https://github.com/${config.repository}/actions/runs/${state.runId}` };
    }
    if (state.expectedRunAttempt && result.run_attempt >= state.expectedRunAttempt) {
      if (state.rerunSignature === state.secretSignature) state.refreshRequired = false;
      clearRerun(); save();
    }
    if (result.status === 'completed' && result.conclusion === 'success') {
      const jobs = api(`${base}/runs/${state.runId}/jobs?per_page=100`).jobs;
      if (!jobs.some((job) => job.name.endsWith(`/ ${config.environment}`) && job.conclusion === 'success'
        && job.steps.some((step) => step.name === 'Publish the selected site' && step.conclusion === 'success'))) throw new Error('githubRunInvalid');
    }
    return { status: result.status, conclusion: result.conclusion ?? '', runId: state.runId, commit: state.commit,
      runAttempt: result.run_attempt,
      url: `https://github.com/${config.repository}/actions/runs/${state.runId}` };
  }
  function clearRerun() {
    for (const key of ['expectedRunAttempt', 'rerunRequestedAt', 'rerunSignature', 'rerunKind']) delete state[key];
  }
  function requestRerun(config, current, kind) {
    state.expectedRunAttempt = current.runAttempt + 1;
    state.rerunRequestedAt = now();
    state.rerunSignature = state.secretSignature;
    state.rerunKind = kind;
    save();
    try { api(`repos/${config.repository}/actions/runs/${state.runId}/${kind === 'all' ? 'rerun' : 'rerun-failed-jobs'}`, 'POST'); }
    catch (error) {
      // A definite refusal cannot produce a run. Network failures and 5xx may
      // have been accepted: keep their intent and reconcile before retrying.
      if (error.requestRejected) { clearRerun(); save(); }
      throw error;
    }
    return { ...current, status: 'queued', conclusion: '' };
  }
  function refresh(config) {
    config = validateDeployment(config);
    const current = status(config);
    if (current.status !== 'completed') return current;
    if (remoteHead(config) !== state.commit) throw new Error('githubRemoteChanged');
    configure(config);
    return requestRerun(config, current, 'all');
  }
  function retry(config) {
    const current = status(config);
    if (current.status === 'completed' && current.conclusion !== 'success') {
      return requestRerun(config, current, state.refreshRequired || state.rerunKind === 'all' ? 'all' : 'failed');
    }
    if (!state.runId) { state.dispatchRequested = false; save(); return status(config, true); }
    return current;
  }
  return { inspect, prepare, configure, publish, status, retry, settings, refresh };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, requestPath, resultPath] = process.argv.slice(2);
  try {
    const request = JSON.parse(readFileSync(requestPath, 'utf8'));
    const directory = dirname(requestPath);
    const service = createGitHubSetup({ root: process.cwd(), directory });
    const value = action === 'inspect' ? service.inspect()
      : action === 'profile' ? createStudioProfile(process.cwd(), request)
        : ['prepare', 'configure', 'publish', 'status', 'retry', 'settings', 'refresh'].includes(action) ? service[action](request) : (() => { throw new Error('githubConfigInvalid'); })();
    writePublicJson(resultPath, { ok: true, value });
  } catch (error) {
    const key = /^(?:github|profile)[A-Za-z]+$/u.test(error.message ?? '') ? error.message : 'githubCommandFailed';
    writePublicJson(resultPath, { ok: false, error: key, ...(error.logPath ? { logPath: error.logPath } : {}) });
    process.exitCode = 1;
  }
}
