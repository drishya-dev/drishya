# REPO-1 public tree inventory

Proposal for Harsh and Yash. The inventory covers the 1,620 tracked files at private main `41814da2`. It describes the intended public tree and the work needed to get there. Main stays the working source until both builders settle the archive and history choice.

## Path decisions

The narrower rule wins where paths overlap. “Curate” means publish the reviewed material or a replacement at that path. “Archive” means keep it in the private development history and leave it out of the public snapshot.

| Path | Proposed disposition | Work before export |
| --- | --- | --- |
| `apps/**`, `packages/**`, `tests/**`, `fixtures/synthetic/**` | Keep after audit | Preserve the source, regression coverage and synthetic demo inputs. Review screenshots, fixture provenance, and bundled assets separately. |
| `apps/site/public/footage/**` | Curate | Review all 16 tracked assets individually. The site and browser suite use this directory. Supply approved replacements for any excluded image and check the site build and browser cases together. |
| Root README, CONTRIBUTING, OWNERSHIP, SECURITY and LICENSE | Curate | Use current release and ownership facts. Point contributors to GitHub issues. Keep the existing licence text until the builders record the PUBLIC-1 licence decision. |
| `AGENTS.md`, `CLAUDE.md`, `.github/**` | Curate | Preserve contributor, testing, release and security guidance. Replace links to the private claim workflow. Preserve CODEOWNERS and the workflow settings that require release dispatch. |
| Root workspace manifests, lockfile, TypeScript and test configs, `.gitignore`, `.gitattributes` | Keep | Check commands and settings against a clean export. |
| `.claude/launch.json` | Curate | Check whether the launch entry is useful outside the private checkout and resolves only paths available in the public tree. |
| `scripts/**` | Keep after audit | Preserve entry points used by package scripts, tests and CI. Review optional benchmark, capture and publishing helpers for private inputs and their dependencies. |
| `scripts/claims.ts`, `scripts/sync-tasks.ts` | Archive | Retain the scripts with their private task and status files. Rewrite contributor instructions before removing the scripts from the public tree. |
| `docs/README.md`, `docs/CODEBASE.md`, `docs/VISION.md`, `docs/CI_POLICY.md`, `docs/DEVELOPER_WORKSPACE.md`, `docs/release-checklist.md` | Curate | Keep the current developer guidance. Replace archival links with curated material and remove private evidence and obsolete instructions. Verify the remaining command and link targets. |
| `docs/reference/02-motion-catalog.md`, `03-event-schema.md`, `04-continuous-canvas.md` in the same directory | Curate | Keep durable contracts and reconcile them with the current code and desktop support. Use the [draft decisions](../decisions/README.md) as the short contributor entry point. |
| `docs/reference/01-evidence-pack.md`, `docs/TASKS.md`, `docs/STATUS.md`, `docs/CONTINUITY.md` | Archive | Preserve the private rationale and task history. Use GitHub issues for the public work list. |
| `docs/BLUEPRINT.md`, `docs/Vantage_Base_Prompt.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/PRODUCT_DELIVERY.md`, `docs/PRODUCT_DIRECTION.md` | Archive | Carry forward current rationale as short decisions. The older task proposal also names `PROJECT_MASTER_DESCRIPTION.md`, which is absent from this tree. |
| `docs/review/**`, `docs/superpowers/**`, `docs/prototype/**` | Archive by default | Extract current contracts and public release or security summaries before replacing links into the working archive. The prototype has its own files and readme. |
| `docs/readme/**` | Keep after media review | Verify screenshots use approved data and check asset attribution. Keep files used by the README. |
| `docs/images/site-3-dots-current-left-clean-right-{hero,2x-crop}.png`, `docs/Logo.png` | Archive with their notes unless needed in curated docs | The comparisons are referenced by the SITE-3 working note. `Logo.png` has references in four working or design documents, including VISION. |
| `docs/Logo (1).png`, `docs/Logo (2).png`, `docs/images/readme-demo.png` | Delete candidates in the public snapshot | An exact filename search of tracked text returned no references. Confirm indirect references and public links before removal. Preserve the originals in the private archive. |

The claim workflow currently appears in AGENTS, CONTRIBUTING and the PR template. The public versions of those files need to change together. The archived canvas references also have cross-links into `docs/review/`. A build check alone will miss broken contributor links.

## History decision for the builders

A fresh history from the audited public snapshot is the current REPO-1 recommendation. It preserves the private repository as the development archive and limits the publication audit to the tree and commits selected for release. The prior SEC-5 history report found personal paths, account names, recording identifiers and earlier footage in history. An existing-history publication would require reviewing those older contents across the refs selected for release. See the [SEC-5 history report](sec-5-history-scan.md).

Once both builders agree, record the chosen history, archive location and rationale in STATUS. Complete the path and media reviews, resolve contributor links, and validate the proposed public snapshot. PUBLIC-1 runs its content audit and SEC-5 checks on the actual history chosen for publication.
