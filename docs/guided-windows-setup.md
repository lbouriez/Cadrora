# Windows installer reference

**Installing for the first time? Start with the short [installation guide](deployment.md).**
This page covers configuration, recovery and validation details for maintainers.

The unit suite always uses Cadrora branding, even inside a studio publication job;
the selected studio is verified by its own build and browser checks. Checkout
identity uses resolved filesystem paths so Windows short names and junction aliases
match the same repository. Windows secret-permission tests retain real ACL checks
with a 60-second budget for tests that start PowerShell processes.

The checked-in `.gitignore` protects `.artifacts/` in every fork, including saved
answers, encrypted keys, credentials, logs and backups. Local environment files
and copied credential files are also ignored. Keep these rules in your fork.
The public profile and `.cadrora/deployments/<instance>.json` are intentionally
versioned so GitHub can publish the selected site. Never force-add private files;
Git ignore rules do not remove a file that was already committed.

Fork Cadrora into your GitHub account, then **clone your fork** to this computer.
A ZIP download is not a Git checkout and cannot be used for automatic updates.
Open the cloned folder in PowerShell and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Language fr
```

Use `-Language en` for English. Review the checked-out script before running it.
You do not need to prepare Cloudflare keys first: the assistant guides those steps.

## What the assistant does

1. Checks Node.js, Git and GitHub CLI. Installs missing tools, or opens the official
   download guidance when winget is unavailable. GitHub CLI handles browser login.
2. Verifies that this is your fork, that the checked-out branch is selected, and
   that your GitHub account can administer its variables, secrets and environments.
3. Offers a new profile copied from `studio`, or an existing personal profile.
   The upstream `cadrora` and `atelier-giulia` examples are not adopted as customer
   targets. New profiles have bilingual copy, a shared editorial layout, semantic
   theme tokens, a guarded settings seed and a customization README.
4. Opens the Cloudflare account/domain, API-token, R2 and Turnstile pages with
   instructions. It checks the active zone, permissions and widget before continuing.
5. Shows the fork, branch, profile, hostname, GitHub environment and exact files
   to commit. **Enter approves saving the deployment secrets to GitHub, committing
   those files, pushing them and starting publication. STOP saves progress.**
6. Configures `<instance>-production` in GitHub, uploads private values through
   stdin to `gh secret set`, and checks the resulting variable values/secret names.
7. Pushes only the selected profile and `.cadrora/deployments/<instance>.json`.
   GitHub Actions performs the first publication, exactly as for later pushes.
8. Follows the matching commit/run, verifies that the selected environment really
   published, checks Cloudflare's enabled Custom Domain and HTTPS pages, then guides
   your first sign-in. The assistant never assumes that sign-in succeeded.

GitHub environment availability depends on repository visibility and account plan.
Repository administrator access is required. Organization restrictions, protected
branches and required environment approvals remain in force. The assistant stops
with guidance instead of removing those protections or force-pushing.

## Configuration and future updates

The public descriptor identifies the repository, branch, environment, profile,
instance and hostname. It contains no secrets. The generic workflow uses the
environment variables and checks that they agree with this descriptor.

| GitHub location | Names |
| --- | --- |
| Repository variable | `CADRORA_DEPLOY_ENABLED=true` |
| Environment variables | `CADRORA_SITE`, `CADRORA_INSTANCE`, `CADRORA_HOSTNAME`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_TURNSTILE_SITE_KEY` |
| Environment secrets | `CLOUDFLARE_API_TOKEN`, `ADMIN_SECRET_HASH`, `AUTH_PEPPER`, `TURNSTILE_SECRET_KEY` |

`ADMIN_PASSWORD` stays in the private local credential artifact; it is not sent to
GitHub. The verifier and pepper remain stable across deployments. An existing
environment with unrelated secrets is not overwritten. Missing local administrator
credentials for an already-configured environment must be restored from backup.

`.github/workflows/publish-sites.yml` selects configurations belonging to this exact
repository and branch. `.github/workflows/publish-site.yml` owns the shared checks,
builds, browser smoke tests, deployment and HTTPS verification. There is no separate
generated workflow copy per customer. A branch push publishes all sites configured
for that branch; manual dispatch can select one environment. Only branch pushes and
explicit dispatch can publish, not pull requests or tag pushes. Concurrent releases
for the same environment are serialized, and outdated commits are refused.

To update your site, commit and push your profile/code changes to the configured
branch. To receive upstream improvements, synchronize your fork first. Changes made
in the site's administration are stored directly in D1 and do not need a Git push.
These owner settings remain authoritative across later releases.

## Stop, resume and diagnostics

Run the same command and choose the same installation name. Progress lives in
`.artifacts/instances/<instance>/progress.json`; GitHub reconciliation checkpoints
are in `github-state.json`. Saved answers include the repository, branch, selected
profile and environment. Private Cloudflare/Turnstile inputs are stored using
Windows DPAPI for this Windows identity. Keep the private installation folder.

The assistant checks actual state on every resume. Profile creation does not
overwrite owner edits. It detects an already-created commit or pushed commit and
follows the existing run instead of submitting another publication. A failed run
offers: check again, open GitHub, explicitly retry, or stop. Ctrl+C stops the local
assistant without cancelling a GitHub run. After a successful run, resume goes
straight to remote/site verification and sign-in, not another push.

The assistant refuses unrelated working-tree changes, unexpected local commits,
changed targets and remote branch movement. It never resets your checkout or force
pushes. Save or set aside unrelated changes before starting. Changes pushed outside
the wizard after an interrupted setup may require reviewing the saved checkpoint;
the assistant will not guess which commit should replace another.

Instruction cards have wrapped text, visible Enter defaults and status colours.
Native tool details go to UTF-8 logs under `logs/`, with known secret values redacted.
GitHub CLI helper errors distinguish authentication, permissions, rate limits,
network failures, provider outages and Git conflicts. A localized message links to
the private `logs/github-errors.log` diagnostic, with secret values redacted and
without command arguments, input bodies or standard output. Remote build details
remain available at the GitHub run URL. Review any
diagnostic file before sharing it.

```powershell
# Read-only local tool diagnostic; no account calls or installations.
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Diagnose -Language fr
# Fictional layout preview; no saved credentials, browser or network access.
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Preview -Language fr
```

Browser confirmations accept Enter; URL/private-key prompts still require a value.
`-ReplaceToken` replaces only the saved Cloudflare API token. Target changes after a
publication has started are fenced. Once the GitHub descriptor is prepared, its
target is also fixed; use a new installation name for another target. Protected
progress writes use atomic replacement with bounded Windows file-lock retries and
a backup; ambiguous replacement failures
stop without overwriting the saved document. The checkout-wide setup lock prevents
two assistants from sharing build/dependency files simultaneously.

Replacing a saved Cloudflare or Turnstile key after the first push is detected on
resume. Once the current run has finished, the assistant asks before synchronizing
the keys and republishing the recorded commit; Enter approves and STOP postpones.
The administrator password is preserved. A branch that has advanced is refused
before refreshing the keys. Interrupted configuration retains its pending state.

A refused GitHub rerun remains retryable. After an ambiguous network/server failure,
the assistant checks for the next run attempt for up to two minutes before offering
an explicit retry. It never silently repeats an uncertain rerun request. Publication
proof includes the run attempt, so an approved rerun can record its new deployment.
Profile commits include tracked deletions and renames as well as additions; unrelated
changes, private files and symbolic links remain rejected.

## Existing local and maintained installations

Previously published local wizard installations retain their original recovery
path. `-Local` explicitly selects the older local provisioner for advanced use;
it does not configure GitHub. This preserves interrupted local installations without
silently changing their publication mechanism.

Atelier Giulia's existing workflow is now a compatibility caller of the same shared
workflow. Its repository gate `ATELIER_GIULIA_DEPLOY_ENABLED`, environment
`atelier-giulia-production`, secret names, target and additional browser/HTTPS
checks remain intact. No live variables or credentials need to change for this
compatibility path. New forks use the generic descriptors and environment variables.

After installation, follow [the launch checklist](after-deployment.md). Replace
starter photos and review every visible text, session and price before sharing the
site. A successful build is not a real client upload/download or biometric QA test.

Local validation covers simulated GitHub/provider boundaries, real isolated Git
commits, Windows state/DPAPI and PowerShell 5.1/7. Fresh-account authentication,
winget/UAC, GitHub account policies and an actual fork push/publication still require
manual QA; the test suite never writes to live GitHub or Cloudflare accounts.

`windows-setup.yml` runs checks and the offline test suite on Windows for pull
requests and pushes, independently of deployment gates. It requires both Windows
PowerShell 5.1 and PowerShell 7, and has no production environment or secrets.

## Manual QA on your fork

Use a fork containing this change and an unused hostname. The upstream checkout
is deliberately rejected by the new path.

1. Start `setup.ps1 -Language fr`, create a personal profile and verify its saved
   folder/name/language. Repeat in English or select an existing personal profile.
2. Stop at the publication summary. Restart with the same installation name:
   answers and profile edits should be preserved, with current Cloudflare checks.
3. Approve publication with Enter. Confirm the GitHub environment has the five
   variables/four secrets listed above, and that the commit contains only the
   selected profile and deployment descriptor.
4. Stop the local assistant while GitHub runs, then resume. It must follow the
   same commit/run and keep the same administrator credentials.
5. Confirm HTTPS and sign in yourself using the local administrator credential
   file. Replace the illustration photos and fill in your contact information.
6. Commit and push a visible profile change. Confirm automatic publication targets
   this environment and preserves settings already edited in the administration.
   Synchronizing upstream workflow improvements uses the same publication path.
7. Replace a saved Cloudflare/Turnstile key, resume, and choose STOP at the refresh
   summary. Resume again and approve with Enter: confirm the new run attempt and
   unchanged administrator password. Do not revoke the old key until ready to test.
8. Before the initial publication of another test installation, delete or rename
   a tracked file in the selected profile. Verify the scoped commit includes that
   change. An unrelated modified file must still prevent the commit.
9. If GitHub refuses a retry or the connection fails, verify the message identifies
   the problem, provides the diagnostic path, and permits a later explicit retry.
