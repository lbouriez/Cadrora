# ADR-057: Guided fork and profile publication

Status: accepted, 2026-11-03 (owner-requested implementation).

## Decision

New Windows installations use a personal GitHub fork and GitHub Actions for both
the first release and subsequent pushes. Git and GitHub CLI are installer tools,
not application runtime dependencies. The assistant checks for them and installs
the official `Git.Git` / `GitHub.cli` winget packages when available; otherwise it
guides the user to the official installers. Authentication uses GitHub CLI's
browser flow and credential store. The assistant never extracts a GitHub token.

`studio` is a maintained, neutral, bilingual profile template. New profiles copy
its data, shared editorial composition, semantic tokens and guarded seed into
`sites/<id>/`. Existing owner edits survive resume. Upstream showcase and Atelier
profiles are examples, not automatic targets for a new photographer's account.

The public `.cadrora/deployments/<instance>.json` descriptor binds repository,
branch, environment, profile, instance and hostname. Each environment has separate
Cloudflare deployment secrets and public variables. The workflow validates those
values against the descriptor before building or publishing. A repository gate
is off until configuration is complete; push events on branches and explicit
dispatch are supported. Pull requests and tags cannot publish.

`publish-site.yml` owns checks, both showcase/selected-profile builds, browser
checks, stale-commit rejection, deployment and HTTPS checks. `publish-sites.yml`
selects descriptors for the exact repository and branch. The maintained Atelier
workflow is a compatibility caller retaining its repository gate, environment,
target and additional browser/HTTPS regression checks. No live secret rotation,
resource recreation or account migration is part of this code change. Future
fork synchronization carries improvements to this shared workflow.

Private values go to `gh secret set` through stdin, never arguments or Git files.
Only the admin verifier and pepper are published as GitHub secrets, not the admin
password. Existing credentials are validated and reused; remote administrator
secrets without their local credential artifact fail closed. GitHub environment
protections are preserved. The assistant requires repository administration
access and an account plan supporting environments for the chosen repository.

The commit contains only the selected profile and descriptor. Other modified
files, unexpected local commits, moved remote branches and changed pinned targets
stop the operation. No force push or automatic reset is allowed. Public local
checkpoints record commit/run IDs, target identity and secret metadata digests.
Resume reconciles actual Git/GitHub state, including the commit-before-checkpoint
window, and follows an existing run. Failed runs need an explicit retry. A green
workflow is insufficient without a successful publication step for the selected
environment, Cloudflare domain proof, HTTPS and the user's first sign-in.

Rerun intent records a timestamp and expected attempt before sending the request.
Definite rejection clears that intent; uncertain outcomes reconcile against GitHub
for two minutes before an explicit retry becomes available. Key changes retain a
pending-publication checkpoint across interruptions and require confirmation to
synchronize and rerun the saved commit. Administrator credentials are preserved;
deployment proof is tied to the run attempt. Scoped commits include deletions and
renames. Categorized errors have a redacted private diagnostic log.

## Compatibility and validation

Already-published local installations retain their verification-only recovery.
`-Local` remains an explicit advanced path for the legacy local provisioner.
Owner D1 content and all runtime contracts stay unchanged. GitHub provider tests
use deterministic fakes; local tests exercise real Git commits and both Windows
PowerShell versions. Fresh-account login, winget/UAC, organization policies and a
real fork publication remain manual QA gates; no such live actions are performed
by the implementation tests.

An independent Windows pull-request/push workflow requires both PowerShell runtimes
and runs the offline suite without deployment gates, environments or secrets.

Provider references: [GitHub CLI secret input](https://cli.github.com/manual/gh_secret_set),
[reusable workflows and environment secrets](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows),
and [environment API and availability](https://docs.github.com/en/rest/deployments/environments).
