import { currentWorkspacePath, type RecordedFileRoot } from './worktree-files.ts';

export interface CheckoutPickerOption {
  kind: 'session' | 'worktree';
  key: string;
  prefix?: string;
  root: string;
  /** Preserves accessible selectors ('Session checkout' on the main row, distinguishing name on others). */
  accessibleName: string;
  /** Primary visible distinguishing name shown on the row and in <summary> when selected. */
  title: string;
  /** Recorded branch if known (never HEAD or detached). */
  branch?: string;
  /** Remaining path tail not already repeated as the primary name. */
  pathTail: string;
  fileCount: number;
  onDisk: 'present' | 'removed' | 'unavailable';
  /** Complete quiet metadata line: [session branch · ] pathTail · fileCount [· disk state]. */
  metadata: string;
  searchText: string;
}

export interface CheckoutPickerModel {
  options: CheckoutPickerOption[];
  activeKey: string;
  summaryTitle: string;
  showFilter: boolean;
}

const FILTER_THRESHOLD = 8;

const isKnownBranch = (branch: string | undefined): branch is string => {
  const trimmed = branch?.trim();
  return !!trimmed && trimmed !== 'HEAD' && trimmed !== 'detached';
};

const pathSegments = (raw: string): string[] =>
  raw.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean);

const worktreeSlotIndex = (parts: readonly string[]): number => {
  const idx = parts.findLastIndex(segment => {
    const lower = segment.toLowerCase();
    return lower === 'worktrees' || lower === '.worktrees';
  });
  return idx >= 0 && idx + 2 === parts.length - 1 ? idx : -1;
};

const formatFileCount = (count: number): string =>
  `${count} ${count === 1 ? 'file' : 'files'}`;

interface Candidate {
  label: string;
  tail: string;
}

function tailAfterSuffix(parts: readonly string[], usedSegments: number): string {
  const remaining = usedSegments > 0 ? parts.slice(0, Math.max(0, parts.length - usedSegments)) : parts;
  if (!remaining.length) return '';
  if (remaining.length === 1 && remaining[0]!.endsWith(':')) return `${remaining[0]}/`;
  return remaining.length > 3 ? `…/${remaining.slice(-3).join('/')}` : remaining.join('/');
}

function buildCandidates(
  parts: readonly string[],
  rawRoot: string,
  branch: string | undefined,
  isSession: boolean,
  sharedBasename: boolean,
): Candidate[] {
  const leaf = parts.at(-1) ?? rawRoot;
  const wtIndex = worktreeSlotIndex(parts);
  const pathCandidates: Candidate[] = [];
  const seen = new Set<string>();
  const pushPath = (label: string, tail: string) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    pathCandidates.push({ label, tail });
  };

  if (wtIndex >= 0 && sharedBasename) {
    const slotIndex = wtIndex + 1;
    const slot = parts[slotIndex]!;
    const afterSlot = parts.slice(slotIndex + 1).join('/');
    const beforeSlot = parts.slice(Math.max(0, wtIndex - 1), slotIndex).join('/');
    const slotPrefix = wtIndex - 1 > 0 ? `…/${beforeSlot}` : beforeSlot;
    pushPath(slot, [slotPrefix, '…', afterSlot].filter(Boolean).join('/'));

    // If two harnesses share the same <slot>/<repo>, keep <slot>/<repo> then walk left from worktrees/<slot>.
    pushPath(parts.slice(slotIndex).join('/'), tailAfterSuffix(parts, parts.length - slotIndex));
    for (let start = wtIndex - 1; start >= 0; start--) {
      const label = parts.slice(start, slotIndex + 1).join('/');
      const leftPrefix = tailAfterSuffix(parts, parts.length - start);
      const tail = [leftPrefix, leaf].filter(Boolean).join('/…/');
      pushPath(label, tail);
    }
    for (let start = parts.length - 2; start >= 0; start--) {
      pushPath(parts.slice(start).join('/'), tailAfterSuffix(parts, parts.length - start));
    }
  } else if (parts.length > 0) {
    for (let len = 1; len <= parts.length; len++) {
      pushPath(parts.slice(-len).join('/'), tailAfterSuffix(parts, len));
    }
  } else {
    pushPath(rawRoot, '');
  }

  if (!isSession && isKnownBranch(branch)) {
    const cleanBranch = branch.trim();
    const result: Candidate[] = [
      { label: cleanBranch, tail: tailAfterSuffix(parts, 0) },
      ...pathCandidates.map(item => ({ label: `${cleanBranch} · ${item.label}`, tail: item.tail })),
    ];
    return result;
  }

  return pathCandidates;
}

interface RawEntry {
  kind: 'session' | 'worktree';
  key: string;
  prefix?: string;
  root: string;
  normalized: string;
  parts: string[];
  branch?: string;
  fileCount: number;
  onDisk: 'present' | 'removed' | 'unavailable';
}

export function buildCheckoutPickerModel(params: {
  fileRoots: readonly RecordedFileRoot[];
  sessionRoot: string | undefined;
  checkoutPrefix: string | undefined;
}): CheckoutPickerModel | undefined {
  const { fileRoots, sessionRoot, checkoutPrefix } = params;
  const otherRoots = fileRoots
    .filter(
      root =>
        (root.fileCount ?? 0) > 0 &&
        currentWorkspacePath(`${root.prefix}/file`, fileRoots as RecordedFileRoot[], sessionRoot) === undefined,
    )
    .sort(
      (a, b) =>
        Number(b.onDisk === 'present') - Number(a.onDisk === 'present') ||
        (b.lastFileSequence ?? 0) - (a.lastFileSequence ?? 0) ||
        a.root.localeCompare(b.root),
    );

  if (!otherRoots.length) return undefined;

  const sessionMatches = sessionRoot
    ? fileRoots.filter(
        root =>
          currentWorkspacePath(`${root.prefix}/file`, fileRoots as RecordedFileRoot[], sessionRoot) !== undefined,
      )
    : [];

  const sessionCount = sessionMatches.reduce((sum, root) => sum + (root.fileCount ?? 0), 0);
  const sessionBranch = sessionMatches.map(root => root.branch).find(isKnownBranch)?.trim();
  const sessionDisk: 'present' | 'removed' | 'unavailable' =
    sessionMatches.some(root => root.onDisk === 'present') || !sessionMatches.length
      ? 'present'
      : sessionMatches[0]!.onDisk === 'removed'
        ? 'removed'
        : 'unavailable';
  const sessionPath = sessionRoot ?? 'Session files';

  const entries: RawEntry[] = [
    {
      kind: 'session',
      key: '__session__',
      root: sessionPath,
      normalized: pathSegments(sessionPath).join('/').toLowerCase(),
      parts: sessionRoot ? pathSegments(sessionPath) : [],
      branch: sessionBranch,
      fileCount: sessionCount,
      onDisk: sessionDisk,
    },
    ...otherRoots.map(root => ({
      kind: 'worktree' as const,
      key: root.prefix,
      prefix: root.prefix,
      root: root.root,
      normalized: pathSegments(root.root).join('/').toLowerCase(),
      parts: pathSegments(root.root),
      branch: isKnownBranch(root.branch) ? root.branch.trim() : undefined,
      fileCount: root.fileCount ?? 0,
      onDisk: (root.onDisk === 'present'
        ? 'present'
        : root.onDisk === 'removed'
          ? 'removed'
          : 'unavailable') as 'present' | 'removed' | 'unavailable',
    })),
  ];

  const basenameCounts = new Map<string, number>();
  for (const entry of entries) {
    const leaf = (entry.parts.at(-1) ?? entry.root).toLowerCase();
    basenameCounts.set(leaf, (basenameCounts.get(leaf) ?? 0) + 1);
  }

  const candidateLists = entries.map(entry => {
    const leaf = (entry.parts.at(-1) ?? entry.root).toLowerCase();
    const sharedBasename = (basenameCounts.get(leaf) ?? 0) > 1;
    return buildCandidates(entry.parts, entry.root, entry.branch, entry.kind === 'session', sharedBasename);
  });

  const chosenIndex = entries.map(() => 0);
  for (;;) {
    const groups = new Map<string, number[]>();
    entries.forEach((_, idx) => {
      const label = candidateLists[idx]![chosenIndex[idx]!]!.label.toLowerCase();
      const bucket = groups.get(label) ?? [];
      bucket.push(idx);
      groups.set(label, bucket);
    });
    let progressed = false;
    for (const bucket of groups.values()) {
      if (bucket.length < 2) continue;
      for (const idx of bucket) {
        if (chosenIndex[idx]! + 1 < candidateLists[idx]!.length) {
          chosenIndex[idx]!++;
          progressed = true;
        }
      }
    }
    if (!progressed) break;
  }

  const options: CheckoutPickerOption[] = entries.map((entry, idx) => {
    const picked = candidateLists[idx]![chosenIndex[idx]!]!;
    const diskNote =
      entry.kind === 'worktree'
        ? entry.onDisk === 'removed'
          ? 'Removed'
          : entry.onDisk === 'unavailable'
            ? 'Unavailable'
            : undefined
        : undefined;
    const countLabel = formatFileCount(entry.fileCount);
    const branchMeta =
      entry.kind === 'session' && entry.branch && entry.branch !== picked.label
        ? entry.branch
        : undefined;
    const metadata = [branchMeta, picked.tail, countLabel, diskNote].filter(Boolean).join(' · ');
    const accessibleName = entry.kind === 'session' ? 'Session checkout' : picked.label;
    return {
      kind: entry.kind,
      key: entry.key,
      prefix: entry.prefix,
      root: entry.root,
      accessibleName,
      title: picked.label,
      branch: entry.branch,
      pathTail: picked.tail,
      fileCount: entry.fileCount,
      onDisk: entry.onDisk,
      metadata,
      searchText: [
        entry.kind === 'session' ? 'session checkout' : '',
        picked.label,
        entry.branch ?? '',
        entry.root,
        metadata,
      ]
        .join(' ')
        .toLowerCase(),
    };
  });

  const active =
    (checkoutPrefix ? options.find(item => item.prefix === checkoutPrefix) : undefined) ?? options[0]!;

  return {
    options,
    activeKey: active.key,
    summaryTitle: active.title,
    showFilter: options.length > FILTER_THRESHOLD,
  };
}

export function filterCheckoutOptions(
  options: readonly CheckoutPickerOption[],
  query: string,
): { present: CheckoutPickerOption[]; unavailable: CheckoutPickerOption[] } {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = tokens.length
    ? options.filter(option => tokens.every(token => option.searchText.includes(token)))
    : options;
  const present: CheckoutPickerOption[] = [];
  const unavailable: CheckoutPickerOption[] = [];
  for (const option of matching) {
    if (option.kind === 'session' || option.onDisk === 'present') present.push(option);
    else unavailable.push(option);
  }
  return { present, unavailable };
}
