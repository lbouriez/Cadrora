import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

const progressCodes = new Set(['resources', 'build', 'database', 'models', 'publish']);
const privateName = /TOKEN|SECRET|PASSWORD|PEPPER|API_KEY|PRIVATE_KEY|AUTHORIZATION/iu;

export function createRedactor(privateDirectory, environment) {
  const values = new Set();
  const remember = (value) => {
    if (!value) return;
    values.add(value);
    values.add(JSON.stringify(value).slice(1, -1));
    for (const line of value.split(/\r?\n/u)) if (line) values.add(line);
  };
  for (const [name, value] of Object.entries(environment)) if (privateName.test(name)) remember(value);
  return (text) => {
    // Credentials can be generated or rotated by the child while it is running.
    // Retain remembered values after the temporary deployment file is removed.
    for (const name of ['admin-credentials.env', 'deploy-secrets.env']) {
      let content;
      try { content = readFileSync(join(privateDirectory, name), 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      for (const line of content.split(/\r?\n/u)) {
        const match = /^([A-Z_]+)=(.*)$/u.exec(line);
        if (!match || !privateName.test(match[1])) continue;
        let value = match[2];
        try { value = JSON.parse(value); } catch { /* Unquoted .env value. */ }
        if (typeof value === 'string') remember(value);
      }
    }
    let safe = stripVTControlCharacters(text);
    for (const value of [...values].sort((a, b) => b.length - a.length)) safe = safe.split(value).join('[REDACTED]');
    return safe.replace(/(Bearer\s+)\S+/giu, '$1[REDACTED]')
      .replace(/(\b(?:[A-Z][A-Z0-9]*_)*(?:TOKEN|SECRET(?:_KEY)?|PASSWORD|PEPPER|API_KEY|PRIVATE_KEY|SECRET_HASH)\s*[=:]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gu, '$1[REDACTED]');
  };
}

export async function runLogged({ logPath, privateDirectory, command, args, cwd = process.cwd(), environment = process.env, notify = (code) => process.stdout.write(`${code}\n`), heartbeatMs = 20_000 }) {
  let descriptor;
  let child;
  let loggingFailed = false;
  try {
    mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
    // The installer already restricts the parent directory to this Windows user.
    descriptor = openSync(logPath, 'ax', 0o600);
    const redact = createRedactor(privateDirectory, environment);
    const record = (stream, line) => {
      if (loggingFailed) return;
      try {
        const safe = line.length > 65_536 ? '[Oversized output line omitted]' : redact(line);
        appendFileSync(descriptor, `${new Date().toISOString()} [${stream}] ${safe}\n`, 'utf8');
      } catch {
        loggingFailed = true;
        notify('log-error');
        // Discard subsequent output rather than exposing an unredacted fallback.
        // Do not interrupt a partially completed Cloudflare operation.
      }
    };
    record('start', basename(command)); // Never record arguments or environment.
    if (loggingFailed) return 1;
    let executable = command;
    let argumentsList = args;
    if (/^npm\.cmd$/iu.test(basename(command))) {
      executable = join(dirname(command), 'node.exe');
      argumentsList = [join(dirname(command), 'node_modules/npm/bin/npm-cli.js'), ...args];
    }
    child = spawn(executable, argumentsList, {
      cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...environment, NO_COLOR: '1', FORCE_COLOR: '0', CADRORA_SETUP_PROGRESS: '1', WRANGLER_SEND_METRICS: 'false' },
    });
    for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
      stream.setEncoding('utf8');
      let pending = '';
      let oversized = false;
      const emit = (line) => {
        const code = line.startsWith('CADRORA_PROGRESS:') ? line.slice('CADRORA_PROGRESS:'.length) : '';
        if (name === 'stdout' && progressCodes.has(code)) notify(code);
        record(name, line);
      };
      stream.on('data', (chunk) => {
        pending += chunk;
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline).replace(/\r$/u, '');
          emit(oversized ? '[Oversized output line omitted]' : line);
          pending = pending.slice(newline + 1);
          oversized = false;
        }
        // Never flush arbitrary chunks: a secret may straddle their boundary.
        if (pending.length > 65_536) { pending = ''; oversized = true; }
      });
      stream.on('end', () => { if (pending || oversized) emit(oversized ? '[Oversized output line omitted]' : pending); });
    }
    const heartbeat = setInterval(() => notify('active'), heartbeatMs);
    const code = await new Promise((done) => {
      child.on('error', () => record('error', 'Could not start the command. Check the installed tools.'));
      child.on('close', (status) => done(status ?? 1));
    });
    clearInterval(heartbeat);
    record('exit', String(code));
    return loggingFailed ? 1 : code;
  } catch {
    notify('log-error');
    return 1;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [logPath, privateDirectory, command, ...args] = process.argv.slice(2);
  // Keep the native exit code, including Windows npm EBUSY/EPERM values.
  process.exitCode = await runLogged({ logPath, privateDirectory, command, args });
}
