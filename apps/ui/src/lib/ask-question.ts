/** Claude's AskUserQuestion, read from its captured input and result text. Display only; unknown shapes return nothing. */
export interface AskOption { label: string; description?: string }
export interface AskQuestion { question: string; header?: string; multiSelect: boolean; options: AskOption[]; /** The captured answer text, when the result names this question. */ answer?: string; chosen: string[]; /** Answer words that are not one of the offered options (the person typed their own). */ typed?: string }

const text = (value: unknown, max = 600) => typeof value === 'string' ? value.slice(0, max) : undefined;

export function askQuestions(input: unknown, result?: string): AskQuestion[] {
  const raw = (input as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(raw)) return [];
  const questions = raw.slice(0, 6).flatMap((item): AskQuestion[] => {
    const entry = item as { question?: unknown; header?: unknown; multiSelect?: unknown; options?: unknown };
    const question = text(entry.question, 800);
    if (!question || !Array.isArray(entry.options)) return [];
    const options = entry.options.slice(0, 8).flatMap((option): AskOption[] => {
      const label = text((option as { label?: unknown })?.label, 200);
      return label ? [{ label, ...(text((option as { description?: unknown }).description) ? { description: text((option as { description?: unknown }).description) } : {}) }] : [];
    });
    return [{ question, ...(text(entry.header, 60) ? { header: text(entry.header, 60) } : {}), multiSelect: entry.multiSelect === true, options, chosen: [] }];
  });
  if (!result) return questions;
  // The result reads: The user answered: "Q1"="A1", "Q2"="A2". Slice each answer between the known questions.
  const marks = questions.map((q) => ({ q, at: result.indexOf(`"${q.question}"="`) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at);
  marks.forEach((mark, index) => {
    const start = mark.at + mark.q.question.length + 4, end = marks[index + 1]?.at ?? result.length;
    const answer = result.slice(start, end).replace(/[",.\s]+$/, '').replace(/^"/, '').trim();
    if (!answer) return;
    mark.q.answer = answer;
    mark.q.chosen = mark.q.options.filter((option) => answer === option.label || mark.q.multiSelect && answer.split(/,\s*/).includes(option.label) || answer.includes(option.label) && mark.q.multiSelect).map((option) => option.label);
    const rest = mark.q.chosen.reduce((left, label) => left.replace(label, ''), answer).replace(/^[,\s]+|[,\s]+$/g, '');
    if (rest && !mark.q.chosen.length) mark.q.typed = answer; else if (rest) mark.q.typed = rest;
  });
  return questions;
}
