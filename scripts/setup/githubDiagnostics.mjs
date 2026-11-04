import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRedactor } from './runLogged.mjs';

export function classifyGitHubFailure(result, fallback = 'githubCommandFailed') {
  const detail = result.stderr || '';
  const httpStatus = Number(/\bHTTP\s+(\d{3})\b/iu.exec(detail)?.[1]) || null;
  let key = fallback;
  if (httpStatus === 429 || /rate limit|secondary rate|abuse detection/iu.test(detail)) key = 'githubRateLimited';
  else if (httpStatus === 401 || /authentication failed|not logged|gh auth login/iu.test(detail)) key = 'githubAuthentication';
  else if (httpStatus === 403) key = 'githubPermissions';
  else if (httpStatus >= 500) key = 'githubProviderUnavailable';
  else if (httpStatus === 409 || /non-fast-forward|fetch first|would be overwritten|merge conflict/iu.test(detail)) key = 'githubGitConflict';
  else if (httpStatus === 422) key = 'githubRequestInvalid';
  else if (result.errorCode === 'ENOENT') key = 'githubToolMissing';
  else if (httpStatus === 408 || result.errorCode === 'ETIMEDOUT' || /timeout|timed out|could not resolve|connection|network|TLS|EOF/iu.test(detail)) key = 'githubNetwork';
  return { key, httpStatus, requestRejected: (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408) || result.errorCode === 'ENOENT' };
}

export function githubFailure({ result, operation, directory, environment, fallback }) {
  const classification = classifyGitHubFailure(result, fallback);
  const error = Object.assign(new Error(classification.key), { requestRejected: classification.requestRejected });
  try {
    const redact = createRedactor(directory, environment);
    // No arguments, request bodies, stdin, stdout or environment snapshots.
    // Redact whole lines before writing; oversized lines are never partially logged.
    const detail = (result.stderr || '').split(/\r?\n/u).slice(0, 40)
      .map((line) => line.length > 4096 ? '[Oversized diagnostic omitted]' : redact(line)
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/gu, '[REDACTED]')
        .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/giu, '$1[REDACTED]@'));
    const logPath = join(directory, 'logs', 'github-errors.log');
    mkdirSync(join(directory, 'logs'), { recursive: true, mode: 0o700 });
    appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), operation,
      exitCode: result.code, httpStatus: classification.httpStatus, category: classification.key, detail })}\n`, { encoding: 'utf8', mode: 0o600 });
    error.logPath = logPath;
  } catch { /* No unredacted console fallback when the private log is unavailable. */ }
  return error;
}
