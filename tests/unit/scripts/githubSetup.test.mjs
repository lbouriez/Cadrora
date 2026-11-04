import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStudioProfile } from '../../../scripts/setup/siteProfile.mjs';
import { createGitHubSetup, githubRepository, writePublicJson } from '../../../scripts/setup/githubSetup.mjs';
import { deploymentMatrix, validateDeployment, validateWorkflowEnvironment } from '../../../scripts/setup/deploymentConfig.mjs';

const temporary = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cadrora-github-'));
  temporary.push(root);
  cpSync('sites/studio', join(root, 'sites/studio'), { recursive: true });
  createStudioProfile(root, { id: 'my-studio', name: "L'Atelier", language: 'en' });
  const directory = join(root, '.artifacts/instances/my-studio');
  mkdirSync(directory, { recursive: true });
  const config = { schemaVersion: 1, repository: 'photographer/Cadrora', branch: 'main', profile: 'my-studio', instance: 'my-studio', hostname: 'photos.example.com', environment: 'my-studio-production' };
  const calls = [];
  const secrets = [];
  const secretValues = new Map();
  const variables = [];
  const remote = { exists: false, runs: [], head: 'a'.repeat(40), local: 'a'.repeat(40), changed: ['.cadrora/deployments/my-studio.json'], staged: [], jobs: [], events: [] };
  const env = { CADRORA_GIT_EXE: 'fake-git', CADRORA_GH_EXE: 'fake-gh', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
    CLOUDFLARE_API_TOKEN: 'private-cloudflare-token', TURNSTILE_SECRET_KEY: 'private-turnstile-key', VITE_TURNSTILE_SITE_KEY: 'public-turnstile-site-key' };
  const credentials = () => {
    const password = 'private-admin-password'; const pepper = 'p'.repeat(43); const salt = 's'.repeat(43);
    const hash = createHmac('sha256', `cadrora-password-admin-v1:${pepper}`).update(`${salt}:${password}`).digest('base64url');
    writeFileSync(join(directory, 'admin-credentials.env'), `ADMIN_PASSWORD=${password}\nAUTH_PEPPER=${pepper}\nADMIN_SECRET_HASH=hmac-sha256$${salt}$${hash}\n`);
  };
  const run = (executable, args, options) => {
    calls.push({ executable, args, hasInput: options.input !== undefined });
    const ok = (value = '') => ({ code: 0, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: '' });
    if (executable === process.execPath) { credentials(); return ok(); }
    if (executable === 'fake-git') {
      if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return ok(root);
      if (args[0] === 'remote') return ok('https://github.com/photographer/Cadrora.git');
      if (args[0] === 'branch') return ok('main');
      if (args[0] === 'check-ref-format') return ok();
      if (args[0] === 'ls-remote') return ok(`${remote.head}\trefs/heads/main`);
      if (args[0] === 'diff') return ok(remote.changed.join('\0'));
      if (args[0] === 'ls-files') return ok();
      if (args[0] === 'rev-parse') return ok(args[1] === 'HEAD^' ? 'a'.repeat(40) : remote.local);
      if (args[0] === 'log') return ok('Set up my-studio\n\nCadrora-Setup: my-studio-production');
      if (args[0] === 'diff-tree') return ok('.cadrora/deployments/my-studio.json');
      if (args[0] === 'add') { remote.staged = args.slice(2); return ok(); }
      if (args.includes('commit')) { remote.local = 'b'.repeat(40); remote.changed = []; return ok(); }
      if (args[0] === 'push') { remote.head = remote.local; remote.events.push('push'); return ok(); }
      throw new Error(`Unexpected git command ${args[0]}`);
    }
    if (args[0] === 'repo') return ok({ nameWithOwner: config.repository, isFork: true, viewerPermission: 'ADMIN' });
    if (args[0] === 'variable') {
      if (!args.includes('--env')) return ok();
      const name = args[2]; const value = args[args.indexOf('--body') + 1];
      const old = variables.find((item) => item.name === name);
      if (old) old.value = value; else variables.push({ name, value });
      return ok();
    }
    if (args[0] === 'secret') {
      expect(options.input).toBeTruthy();
      const name = args[2];
      secretValues.set(name, options.input);
      const old = secrets.find((item) => item.name === name);
      if (old) old.updated_at = '2026-11-03T12:00:00Z'; else secrets.push({ name, updated_at: '2026-11-03T12:00:00Z' });
      return ok();
    }
    const method = args[args.indexOf('--method') + 1];
    const path = args[5];
    if (path === 'user') return ok({ login: 'photographer', id: 1234 });
    if (path.endsWith('/variables?per_page=100')) return ok({ variables });
    if (path.endsWith('/secrets?per_page=100')) return ok({ secrets });
    if (path.endsWith(`/environments/${config.environment}`)) {
      if (method === 'PUT') { remote.exists = true; return ok({}); }
      return remote.exists ? ok({ deployment_branch_policy: { custom_branch_policies: true } }) : { code: 1, stdout: '', stderr: 'HTTP 404' };
    }
    if (path.includes('deployment-branch-policies')) return ok({ branch_policies: [{ name: 'main', type: 'branch' }] });
    if (path.endsWith('/actions/permissions')) return ok({ enabled: true });
    if (path.endsWith('/enable')) { remote.events.push('enable'); return ok(); }
    if (path.includes('/runs?')) return ok({ workflow_runs: remote.runs });
    if (path.endsWith('/dispatches')) { remote.events.push('dispatch'); return ok(); }
    if (path.endsWith('/jobs?per_page=100')) return ok({ jobs: remote.jobs });
    if (path.endsWith('/rerun-failed-jobs') || path.endsWith('/rerun')) { remote.events.push(path.endsWith('/rerun') ? 'refresh' : 'retry'); return ok(); }
    if (path.includes('/actions/runs/')) return ok(remote.runs[0]);
    throw new Error(`Unexpected API path ${path}`);
  };
  const service = () => createGitHubSetup({ root, directory, env, run });
  return { root, directory, config, calls, secrets, secretValues, variables, remote, env, service, credentials, run };
}

describe('profile and GitHub deployment setup', () => {
  it('recognizes a checkout alias but still rejects a different directory', () => {
    const f = fixture();
    const alias = join(f.root, 'checkout-alias');
    symlinkSync(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const inspectAt = (checkout) => createGitHubSetup({ root: f.root, directory: f.directory, env: f.env,
      run(command, args, options) {
        if (command === 'fake-git' && args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
          return { code: 0, stdout: checkout, stderr: '' };
        }
        return f.run(command, args, options);
      } });
    expect(inspectAt(alias).inspect().repository).toBe(f.config.repository);
    expect(() => inspectAt(join(f.root, 'sites')).inspect()).toThrow('githubCheckoutRequired');
  });
  it('creates a portable bilingual studio, escapes SQL names and preserves owner edits on resume', () => {
    const f = fixture();
    expect(readFileSync(join(f.root, 'sites/my-studio/initial-settings.sql'), 'utf8')).toContain("site_name = 'L''Atelier', default_language = 'en'");
    expect(readFileSync(join(f.root, 'sites/my-studio/theme.css'), 'utf8')).toContain("data-site='my-studio'");
    expect(readFileSync(join(f.root, 'sites/my-studio/site.ts'), 'utf8')).toContain('id: profile.id');
    writeFileSync(join(f.root, 'sites/my-studio/theme.css'), '/* owner changes */');
    createStudioProfile(f.root, { id: 'my-studio', name: "L'Atelier", language: 'en' });
    expect(readFileSync(join(f.root, 'sites/my-studio/theme.css'), 'utf8')).toBe('/* owner changes */');
    expect(() => createStudioProfile(f.root, { id: '../outside', name: 'Name', language: 'fr' })).toThrow('profileInvalid');
    expect(() => createStudioProfile(f.root, { id: 'my-studio', name: 'Someone else', language: 'en' })).toThrow('profileExists');
  });
  it('accepts only a GitHub fork origin, without URL credentials or upstream publication', () => {
    expect(githubRepository('git@github.com:photographer/Cadrora.git')).toBe('photographer/Cadrora');
    for (const remote of ['https://github.com/lbouriez/Cadrora.git', 'https://token@github.com/user/repo', 'https://evil.test/user/repo', '-u origin']) expect(() => githubRepository(remote)).toThrow('githubForkRequired');
  });
  it('writes a reviewed target descriptor, scopes branch/repository and validates workflow variables', () => {
    const f = fixture(); f.service().prepare(f.config);
    expect(deploymentMatrix(f.root, f.config.repository, 'main')).toEqual([{ environment: f.config.environment }]);
    expect(deploymentMatrix(f.root, 'other/fork', 'main')).toEqual([]);
    expect(deploymentMatrix(f.root, f.config.repository, 'feature')).toEqual([]);
    const environment = { GITHUB_REPOSITORY: f.config.repository, GITHUB_REF_NAME: 'main', CADRORA_SITE: f.config.profile,
      CADRORA_INSTANCE: f.config.instance, CADRORA_HOSTNAME: f.config.hostname, CADRORA_ENVIRONMENT: f.config.environment };
    expect(validateWorkflowEnvironment(f.root, environment)).toEqual(f.config);
    const reordered = Object.fromEntries(Object.entries(f.config).reverse());
    expect(f.service().prepare(reordered).config).toEqual(f.config);
    expect(() => validateWorkflowEnvironment(f.root, { ...environment, CADRORA_HOSTNAME: 'other.example.com' })).toThrow('githubConfigConflict');
    expect(() => validateDeployment({ ...f.config, branch: 'main\nrun evil' })).toThrow('githubConfigInvalid');
  });
  it('stores private values only through stdin and rechecks before reusing remote configuration', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    expect(f.secrets.map((item) => item.name).sort()).toEqual(['ADMIN_SECRET_HASH', 'AUTH_PEPPER', 'CLOUDFLARE_API_TOKEN', 'TURNSTILE_SECRET_KEY']);
    const all = JSON.stringify(f.calls) + readFileSync(join(f.directory, 'github-state.json'), 'utf8');
    for (const value of [f.env.CLOUDFLARE_API_TOKEN, f.env.TURNSTILE_SECRET_KEY, 'private-admin-password', 'p'.repeat(43)]) expect(all).not.toContain(value);
    expect(f.calls.filter((call) => call.args[0] === 'secret').every((call) => call.hasInput && !call.args.includes('--body'))).toBe(true);
    const before = f.calls.filter((call) => call.args[0] === 'secret').length;
    f.service().configure(f.config);
    expect(f.calls.filter((call) => call.args[0] === 'secret')).toHaveLength(before);
    f.secrets[0].updated_at = 'external change';
    expect(() => f.service().configure(f.config)).toThrow('githubSecretsChanged');
  });
  it('does not regenerate lost administrator credentials or adopt an unrelated environment', () => {
    const f = fixture(); f.service().configure(f.config);
    rmSync(join(f.directory, 'admin-credentials.env'));
    expect(() => f.service().configure(f.config)).toThrow('githubCredentialsMissing');
    f.variables.length = 0;
    expect(() => f.service().configure(f.config)).toThrow('githubEnvironmentInUse');
  });
  it('enables the workflow before pushing, resumes the same commit and avoids duplicate dispatch', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    expect(f.service().publish(f.config).status).toBe('queued');
    expect(f.remote.events).toEqual(['enable', 'push']);
    const commitCalls = f.calls.filter((call) => call.args.includes('commit')).length;
    expect(f.service().publish(f.config).status).toBe('queued');
    expect(f.remote.events.filter((event) => event === 'push')).toHaveLength(1);
    expect(f.calls.filter((call) => call.args.includes('commit'))).toHaveLength(commitCalls);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1 }];
    f.remote.jobs = [{ name: 'publish / Publication / my-studio-production', conclusion: 'success', steps: [{ name: 'Publish the selected site', conclusion: 'success' }] }];
    expect(f.service().status(f.config).runId).toBe(42);
    expect(f.remote.events).not.toContain('dispatch');
    f.remote.jobs[0].steps[0].conclusion = 'skipped';
    expect(() => f.service().status(f.config)).toThrow('githubRunInvalid');
  });
  it('recovers a push that reached GitHub but lost its local receipt', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    const interrupted = createGitHubSetup({ root: f.root, directory: f.directory, env: f.env,
      run(executable, args, options) {
        const result = f.run(executable, args, options);
        if (args[0] === 'push') return { code: 1, stdout: '', stderr: 'Connection lost after acceptance' };
        return result;
      } });
    expect(() => interrupted.publish(f.config)).toThrow('githubNetwork');
    expect(JSON.parse(readFileSync(join(f.directory, 'github-state.json'), 'utf8')).pushedCommit).toBeUndefined();
    expect(f.service().publish(f.config).status).toBe('queued');
    expect(f.remote.events.filter((event) => event === 'push')).toHaveLength(1);
    expect(f.remote.events).not.toContain('dispatch');
    expect(JSON.parse(readFileSync(join(f.directory, 'github-state.json'), 'utf8')).pushedCommit).toBe(f.remote.head);
  });
  it('refuses unrelated changes and a remote branch that advanced', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    f.remote.changed.push('src/another-change.ts');
    expect(() => f.service().publish(f.config)).toThrow('githubUnrelatedChanges');
    expect(f.remote.staged).toEqual([]);
    f.remote.changed.pop(); f.remote.head = 'c'.repeat(40);
    expect(() => f.service().publish(f.config)).toThrow('githubRemoteChanged');
    expect(f.remote.events).not.toContain('push');
  });
  it('recovers an interrupted commit checkpoint without creating a second commit', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    const path = join(f.directory, 'github-state.json');
    const state = JSON.parse(readFileSync(path, 'utf8')); state.baseCommit = f.remote.head;
    writePublicJson(path, state); f.remote.local = 'b'.repeat(40); f.remote.changed = [];
    f.service().publish(f.config);
    expect(f.calls.some((call) => call.args.includes('commit'))).toBe(false);
    expect(f.remote.events).toContain('push');
  });
  it('uses an explicit retry for failed runs and waits for the new attempt', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'failure', run_attempt: 1 }];
    expect(f.service().status(f.config).conclusion).toBe('failure');
    expect(f.remote.events).not.toContain('retry');
    expect(f.service().retry(f.config).status).toBe('queued');
    expect(f.service().status(f.config).status).toBe('queued');
    f.remote.runs[0].run_attempt = 2;
    expect(f.service().status(f.config).conclusion).toBe('failure');
  });
  it('prepares a real Git commit containing only the profile and deployment file', () => {
    const f = fixture();
    const git = (...args) => {
      const result = spawnSync('git', args, { cwd: f.root, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0); return result.stdout.trim();
    };
    git('init', '-b', 'main');
    writeFileSync(join(f.root, '.gitignore'), '.artifacts/\n');
    git('add', '.gitignore', 'sites/studio'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'Base');
    git('remote', 'add', 'origin', 'https://github.com/photographer/Cadrora.git');
    f.remote.head = git('rev-parse', 'HEAD');
    const mixedRunner = (executable, args, options) => {
      if (executable !== 'fake-git') return f.run(executable, args, options);
      if (args[0] === 'ls-remote') return { code: 0, stdout: `${f.remote.head}\trefs/heads/main`, stderr: '' };
      if (args[0] === 'push') { f.remote.head = git('rev-parse', 'HEAD'); return { code: 0, stdout: '', stderr: '' }; }
      const result = spawnSync('git', args, { cwd: f.root, encoding: 'utf8' });
      return { code: result.status, stdout: result.stdout, stderr: result.stderr };
    };
    const service = createGitHubSetup({ root: f.root, directory: f.directory, env: f.env, run: mixedRunner });
    service.prepare(f.config); service.configure(f.config); service.publish(f.config);
    const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split('\n');
    expect(files).toContain('.cadrora/deployments/my-studio.json');
    expect(files).toContain('sites/my-studio/site.ts');
    expect(files.every((file) => file.startsWith('sites/my-studio/') || file === '.cadrora/deployments/my-studio.json')).toBe(true);
    expect(git('status', '--porcelain')).toBe('');
    expect(existsSync(join(f.root, '.cadrora/deployments/my-studio.json'))).toBe(true);
    expect(resolve(f.root, 'sites/my-studio')).toContain(f.root);
  }, 30_000);
  it.each([403, 429, 422])('allows another explicit rerun after HTTP %i rejection', (code) => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'failure', run_attempt: 1 }];
    let refuse = true;
    const service = () => createGitHubSetup({ root: f.root, directory: f.directory, env: f.env, run(command, args, options) {
      if (refuse && args.some((argument) => argument.endsWith('/rerun-failed-jobs'))) return { code: 1, stdout: '', stderr: `HTTP ${code}` };
      return f.run(command, args, options);
    } });
    expect(() => service().retry(f.config)).toThrow();
    expect(service().status(f.config).status).toBe('completed');
    refuse = false;
    expect(service().retry(f.config).status).toBe('queued');
    expect(f.remote.events.filter((event) => event === 'retry')).toHaveLength(1);
  });
  it.each([true, false])('reconciles an ambiguous rerun without replaying it (accepted=%s)', (accepted) => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'failure', run_attempt: 1 }];
    let clock = 1000; let requests = 0;
    const service = () => createGitHubSetup({ root: f.root, directory: f.directory, env: f.env, now: () => clock,
      run(command, args, options) {
        if (args.some((argument) => argument.endsWith('/rerun-failed-jobs')) && ++requests === 1) {
          return { code: 1, stdout: '', stderr: 'HTTP 502: response lost' };
        }
        return f.run(command, args, options);
      } });
    expect(() => service().retry(f.config)).toThrow('githubProviderUnavailable');
    expect(service().status(f.config).status).toBe('queued');
    expect(service().retry(f.config).status).toBe('queued');
    expect(requests).toBe(1);
    if (accepted) { f.remote.runs[0].run_attempt = 2; f.remote.runs[0].status = 'in_progress'; }
    clock += 120_001;
    expect(service().status(f.config).status).toBe(accepted ? 'in_progress' : 'completed');
    if (!accepted) {
      expect(service().status(f.config).conclusion).toBe('rerun-unconfirmed');
      expect(service().retry(f.config).status).toBe('queued');
      expect(requests).toBe(2);
    } else expect(requests).toBe(1);
  });
  it('recovers a legacy pending rerun with no request timestamp', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'failure', run_attempt: 1 }];
    const path = join(f.directory, 'github-state.json');
    writePublicJson(path, { ...JSON.parse(readFileSync(path, 'utf8')), runId: 42, expectedRunAttempt: 2 });
    expect(f.service().status(f.config).conclusion).toBe('rerun-unconfirmed');
    expect(f.service().retry(f.config).status).toBe('queued');
  });
  it.each(['CLOUDFLARE_API_TOKEN', 'TURNSTILE_SECRET_KEY', 'VITE_TURNSTILE_SITE_KEY'])('refreshes changed %s and waits for its own new attempt', (key) => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    const credentials = readFileSync(join(f.directory, 'admin-credentials.env'), 'utf8');
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1 }];
    f.remote.jobs = [{ name: 'Publication / my-studio-production', conclusion: 'success', steps: [{ name: 'Publish the selected site', conclusion: 'success' }] }];
    expect(f.service().settings(f.config).changed).toBe(false);
    const before = f.calls.length;
    f.env[key] = 'new-key-value-for-test';
    expect(f.service().settings(f.config).changed).toBe(true);
    expect(f.calls).toHaveLength(before); // Comparison itself is read-only.
    // Simulate a process ending after configuration, before requesting publication.
    f.service().configure(f.config);
    if (key === 'VITE_TURNSTILE_SITE_KEY') expect(f.variables.find((item) => item.name === key).value).toBe(f.env[key]);
    else expect(f.secretValues.get(key)).toBe(f.env[key]);
    expect(f.service().settings(f.config).changed).toBe(true);
    expect(f.service().refresh(f.config).status).toBe('queued');
    expect(f.remote.events.filter((event) => event === 'refresh')).toHaveLength(1);
    expect(f.service().refresh(f.config).status).toBe('queued');
    expect(f.remote.events.filter((event) => event === 'refresh')).toHaveLength(1);
    f.remote.runs[0].run_attempt = 2;
    expect(f.service().status(f.config).conclusion).toBe('success');
    expect(f.service().settings(f.config).changed).toBe(false);
    expect(readFileSync(join(f.directory, 'admin-credentials.env'), 'utf8')).toBe(credentials);
    expect(f.remote.events.filter((event) => event === 'push')).toHaveLength(1);
  });
  it('waits for an active run and refuses key refresh if the remote branch has advanced', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.remote.runs = [{ id: 42, head_sha: f.remote.head, head_branch: 'main', event: 'push', status: 'in_progress', run_attempt: 1 }];
    f.env.CLOUDFLARE_API_TOKEN = 'replacement-token';
    const writes = () => f.calls.filter((call) => ['secret', 'variable'].includes(call.args[0])).length;
    const before = writes();
    expect(f.service().refresh(f.config).status).toBe('in_progress');
    expect(writes()).toBe(before);
    f.remote.runs[0].status = 'completed'; f.remote.runs[0].conclusion = 'failure';
    f.remote.head = 'c'.repeat(40);
    expect(() => f.service().refresh(f.config)).toThrow('githubRemoteChanged');
    expect(writes()).toBe(before);
    expect(f.remote.events).not.toContain('refresh');
  });
  it('resumes a key refresh interrupted halfway through writing secrets', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config); f.service().publish(f.config);
    f.env.CLOUDFLARE_API_TOKEN = 'replacement-token';
    const interrupted = createGitHubSetup({ root: f.root, directory: f.directory, env: f.env, run(command, args, options) {
      if (args[0] === 'secret' && args[2] === 'TURNSTILE_SECRET_KEY') return { code: 1, stderr: 'HTTP 502', stdout: '' };
      return f.run(command, args, options);
    } });
    expect(() => interrupted.configure(f.config)).toThrow('githubProviderUnavailable');
    expect(f.service().settings(f.config).changed).toBe(true);
    f.service().configure(f.config);
    expect(f.secretValues.get('CLOUDFLARE_API_TOKEN')).toBe('replacement-token');
    expect(f.service().settings(f.config).changed).toBe(true);
    expect(JSON.parse(readFileSync(join(f.directory, 'github-state.json'), 'utf8')).configuringSignature).toBeUndefined();
  });
  it('commits deletions and renames inside an existing profile using real Git', () => {
    const f = fixture();
    const git = (...args) => {
      const result = spawnSync('git', args, { cwd: f.root, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0); return result.stdout.trim();
    };
    git('init', '-b', 'main'); writeFileSync(join(f.root, '.gitignore'), '.artifacts/\n');
    writeFileSync(join(f.root, 'sites/my-studio/photo ancienne.txt'), 'fixture photo');
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'Base');
    git('remote', 'add', 'origin', 'https://github.com/photographer/Cadrora.git');
    f.remote.head = git('rev-parse', 'HEAD');
    const service = createGitHubSetup({ root: f.root, directory: f.directory, env: f.env,
      run(command, args, options) {
        if (command !== 'fake-git') return f.run(command, args, options);
        if (args[0] === 'ls-remote') return { code: 0, stdout: f.remote.head, stderr: '' };
        if (args[0] === 'push') { f.remote.head = git('rev-parse', 'HEAD'); return { code: 0, stdout: '', stderr: '' }; }
        const result = spawnSync('git', args, { cwd: f.root, encoding: 'utf8' });
        return { code: result.status, stdout: result.stdout, stderr: result.stderr };
      } });
    service.prepare(f.config); service.configure(f.config);
    rmSync(join(f.root, 'sites/my-studio/README.md'));
    renameSync(join(f.root, 'sites/my-studio/photo ancienne.txt'), join(f.root, 'sites/my-studio/photo été.txt'));
    service.publish(f.config);
    expect(git('status', '--porcelain')).toBe('');
    const changes = git('diff-tree', '--no-commit-id', '--name-status', '--no-renames', '-z', '-r', 'HEAD');
    expect(changes).toContain('D\0sites/my-studio/README.md');
    expect(changes).toContain('D\0sites/my-studio/photo ancienne.txt');
    expect(changes).toContain('A\0sites/my-studio/photo été.txt');
  }, 30_000);
  it('still rejects private files and symbolic links in the selected profile', () => {
    const f = fixture(); f.service().prepare(f.config); f.service().configure(f.config);
    writeFileSync(join(f.root, 'sites/my-studio/private.pem'), 'not a real key');
    expect(() => f.service().publish(f.config)).toThrow('githubUnsafeFiles');
    rmSync(join(f.root, 'sites/my-studio/private.pem'));
    symlinkSync(join(f.root, 'sites/studio'), join(f.root, 'sites/my-studio/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => f.service().publish(f.config)).toThrow('profileInvalid');
    expect(f.remote.events).not.toContain('push');
  });
});
