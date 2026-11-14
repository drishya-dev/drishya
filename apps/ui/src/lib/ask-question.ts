/** Native question tools from Claude Code, Codex and Antigravity; display only. */
export const isQuestionTool = (tool: unknown) => tool === 'AskUserQuestion' || tool === 'request_user_input_async' || tool === 'request_user_input' || tool === 'ask_question';

/** A question read from its captured input and result text (Claude's AskUserQuestion, Codex's request_user_input_async). Display only; unknown shapes return nothing. */
export interface AskOption { label: string; description?: string }
export interface AskQuestion { id?: string; question: string; header?: string; multiSelect: boolean; options: AskOption[]; /** The answer text, when the result names this question. */ answer?: string; chosen: string[]; /** Recorded Antigravity ordinal protocol, not an inferred answer. */ native?: boolean; skipped?: boolean; /** Answer words that are not one of the offered options (the person typed their own). */ typed?: string }

export interface QuestionReceipt {
  sentAt: number;
  answers: Record<string, { options: string[]; text?: string }>;
  chosen: string[];
  typed?: string;
}

const receipts = new Map<string, QuestionReceipt>();
const stops = new Set<string>();

/**
 * Record a controller answer receipt for a question.
 * Submitted controller receipt remains distinct from captured journal answers.
 */
export function recordQuestionReceipt(
  recordingId: string,
  key: string,
  answers: Record<string, { options: string[]; text?: string }>,
  questions?: AskQuestion[]
) {
  const chosen: string[] = [];
  const typedParts: string[] = [];
  for (const q of questions ?? []) {
    const qAnswer = answers[q.id ?? q.question] ?? Object.values(answers)[0];
    if (qAnswer) {
      if (qAnswer.options?.length) {
        for (const optId of qAnswer.options) {
          const opt = q.options.find((o, idx) => o.label === optId || `o${idx}` === optId);
          if (opt) chosen.push(opt.label);
          else chosen.push(optId);
        }
      }
      if (qAnswer.text?.trim()) typedParts.push(qAnswer.text.trim());
    }
  }
  if (!chosen.length && !typedParts.length) {
    for (const val of Object.values(answers)) {
      if (val.options?.length) chosen.push(...val.options);
      if (val.text?.trim()) typedParts.push(val.text.trim());
    }
  }
  receipts.set(`${recordingId}/${key}`, {
    sentAt: Date.now(),
    answers,
    chosen,
    typed: typedParts.length ? typedParts.join(', ') : undefined,
  });
  if (key) {
    receipts.set(key, {
      sentAt: Date.now(),
      answers,
      chosen,
      typed: typedParts.length ? typedParts.join(', ') : undefined,
    });
  }
}

export function getQuestionReceipt(recordingId?: string, key?: string): QuestionReceipt | undefined {
  if (!key) return undefined;
  if (recordingId && receipts.has(`${recordingId}/${key}`)) {
    return receipts.get(`${recordingId}/${key}`);
  }
  return receipts.get(key);
}

export function recordQuestionStop(recordingId: string, key: string) {
  stops.add(`${recordingId}/${key}`);
  stops.add(key);
}

export function isQuestionStopped(recordingId?: string, key?: string): boolean {
  if (!key) return false;
  if (recordingId && stops.has(`${recordingId}/${key}`)) return true;
  return stops.has(key);
}

export function clearQuestionReceipts() {
  receipts.clear();
  stops.clear();
}

const text = (value: unknown, max = 600) => typeof value === 'string' ? value.slice(0, max) : undefined;

export function askQuestions(input: unknown, result?: string, tool?: string): AskQuestion[] {
  const native = tool === 'ask_question';
  const ordinals = new Map<number, AskQuestion>();
  const raw = (input as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(raw)) return [];
  const questions = raw.slice(0, 6).flatMap((item, ordinal): AskQuestion[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    // Codex names the question `title` and lists options as plain strings, or none at all; Claude uses `question` and {label, description}.
    const entry = item as { id?: unknown; question?: unknown; title?: unknown; header?: unknown; multiSelect?: unknown; is_multi_select?: unknown; options?: unknown };
    const question = text(entry.question ?? entry.title, 800);
    if (!question) return [];
    const offered = Array.isArray(entry.options) ? entry.options : [];
    if (!Array.isArray(entry.options) && entry.question !== undefined) return [];
    const options = offered.slice(0, 8).flatMap((option): AskOption[] => {
      // A capture that summarised a deep option leaves `{…}`; that is a placeholder, not an offered choice.
      if (typeof option === 'string') return option && !/^[{[]…[}\]]$/.test(option) ? [{ label: option.slice(0, 200) }] : [];
      const label = text((option as { label?: unknown })?.label, 200);
      return label ? [{ label, ...(text((option as { description?: unknown }).description) ? { description: text((option as { description?: unknown }).description) } : {}) }] : [];
    });
    const parsed: AskQuestion = { ...(typeof entry.id === 'string' ? { id: entry.id } : {}), question, ...(text(entry.header, 60) ? { header: text(entry.header, 60) } : {}), multiSelect: native ? entry.is_multi_select === true : entry.multiSelect === true, options, chosen: [], ...(native ? { native: true } : {}) };
    if (native) ordinals.set(ordinal + 1, parsed);
    return [parsed];
  });
  if (!result) return questions;
  if (native) {
    if (result.length >= 4000 && result.endsWith('…')) return questions;
    // The native tool returns timestamps and one-based A<n> receipts, not arbitrary prose.
    const lines = result.trimEnd().split(/\r?\n/);
    const created = /^Created At:\s*(.+)$/.exec(lines[0] ?? ''), completed = /^Completed At:\s*(.+)$/.exec(lines[1] ?? '');
    if (!created || !completed || !Number.isFinite(Date.parse(created[1]!)) || !Number.isFinite(Date.parse(completed[1]!))) return questions;
    const receipts = lines.slice(2).map(line => /^A([1-9]\d*): (.*)$/.exec(line));
    if (!receipts.length || receipts.some(receipt => !receipt)) return questions;
    for (const receipt of receipts) {
      const ordinal = Number(receipt![1]), question = ordinals.get(ordinal);
      if (!question || receipts.filter(other => other![1] === receipt![1]).length !== 1) continue;
      const answer = receipt![2]!;
      if (!answer) continue;
      if (answer === 'User Skipped') {
        // The sentinel can also be a literal option; that collision is unresolved.
        if (!question.options.some(option => option.label === answer)) question.skipped = true;
        continue;
      }
      question.answer = answer;
      const matching = question.options.filter(option => option.label === answer);
      question.chosen = matching.length === 1 ? [answer] : [];
      if (!question.chosen.length) question.typed = answer;
    }
    return questions;
  }
  // Native Codex returns keyed answer arrays. Match only the question's captured id;
  // accepted acknowledgements and later user prose are never evidence of an answer.
  try {
    const value = JSON.parse(result);
    if (value?.answers && typeof value.answers === 'object' && !Array.isArray(value.answers)) {
      for (const question of questions) {
        if (!question.id || questions.filter(q => q.id === question.id).length !== 1) continue;
        const reply = Object.hasOwn(value.answers, question.id) ? value.answers[question.id]?.answers : undefined;
        if (!Array.isArray(reply) || !reply.length || !reply.every(v => typeof v === 'string')) continue;
        question.answer = reply.join(', ');
        question.chosen = question.options.filter(option => reply.includes(option.label)).map(option => option.label);
        const rest = reply.filter(v => !question.chosen.includes(v));
        if (rest.length) question.typed = rest.join(', ');
      }
      return questions;
    }
  } catch { /* Older Claude results use literal answer framing below. */ }
  // Claude Code appends its own instruction after the last answer ("." then e.g. "Read the answers carefully…"). That
  // sentence has no double quotes; cut it so it is never shown as the person's words.
  result = result.replace(/"\.\s+[A-Z][^"]*$/, '"');
  // The result reads: The user answered: "Q1"="A1", "Q2"="A2". Slice each answer between the known questions.
  const marks = questions.map((q) => ({ q, at: result.indexOf(`"${q.question}"="`) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at);
  marks.forEach((mark, index) => {
    const start = mark.at + mark.q.question.length + 4, end = marks[index + 1]?.at ?? result.length;
    const segment = result.slice(start, end);
    // Newer Claude results append the selected option's preview outside the answer's
    // closing quote. That is harness/option material, never words the person typed.
    const previewAt = segment.indexOf('" selected preview:');
    const hasPreview = previewAt >= 0 && mark.q.options.some((option) => option.label === segment.slice(0, previewAt));
    const framed = hasPreview ? segment.slice(0, previewAt + 1) : segment;
    const answer = framed.replace(/"\s*(?:,\s*|\.\s*)?$/, '').trim();
    if (!answer) return;
    mark.q.answer = answer;
    const parts = answer.split(',').map((part) => part.trim());
    const counts = new Map<string, number>();
    for (const option of mark.q.options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
    // This protocol has answer text, not stable selected-option ids. Comma-bearing or
    // repeated labels cannot be distinguished reliably; retain them as literal words.
    const ambiguous = mark.q.multiSelect && mark.q.options.some((option) => option.label.includes(',') && answer.includes(option.label));
    mark.q.chosen = ambiguous ? [] : mark.q.options.filter((option) => counts.get(option.label) === 1 &&
      (mark.q.multiSelect ? parts.includes(option.label) : answer === option.label)).map((option) => option.label);
    const chosen = new Set(mark.q.chosen);
    const rest = mark.q.multiSelect && chosen.size ? parts.filter((part) => !chosen.has(part)).join(', ') : chosen.size ? '' : answer;
    if (rest) mark.q.typed = rest;
  });
  return questions;
}

/** What Codex recorded as the result of a question: only whether it was accepted (`{"accepted":true}`), never the answer. */
export function questionAcceptance(result?: string): boolean | undefined {
  if (!result) return undefined;
  try {
    const parsed = JSON.parse(result) as { accepted?: unknown };
    return typeof parsed?.accepted === 'boolean' ? parsed.accepted : undefined;
  } catch { return undefined; }
}
