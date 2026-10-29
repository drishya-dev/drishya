/** The tools that put a question to the person: Claude's AskUserQuestion and Codex's request_user_input_async. */
export const isQuestionTool = (tool: unknown) => tool === 'AskUserQuestion' || tool === 'request_user_input_async' || tool === 'request_user_input';

/** A question read from its captured input and result text (Claude's AskUserQuestion, Codex's request_user_input_async). Display only; unknown shapes return nothing. */
export interface AskOption { label: string; description?: string }
export interface AskQuestion { id?: string; question: string; header?: string; multiSelect: boolean; options: AskOption[]; /** The captured answer text, when the result names this question. */ answer?: string; chosen: string[]; /** Answer words that are not one of the offered options (the person typed their own). */ typed?: string }

const text = (value: unknown, max = 600) => typeof value === 'string' ? value.slice(0, max) : undefined;

export function askQuestions(input: unknown, result?: string): AskQuestion[] {
  const raw = (input as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(raw)) return [];
  const questions = raw.slice(0, 6).flatMap((item): AskQuestion[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    // Codex names the question `title` and lists options as plain strings, or none at all; Claude uses `question` and {label, description}.
    const entry = item as { id?: unknown; question?: unknown; title?: unknown; header?: unknown; multiSelect?: unknown; options?: unknown };
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
    return [{ ...(typeof entry.id === 'string' ? { id: entry.id } : {}), question, ...(text(entry.header, 60) ? { header: text(entry.header, 60) } : {}), multiSelect: entry.multiSelect === true, options, chosen: [] }];
  });
  if (!result) return questions;
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
