// Synthetic captured TodoWrite snapshots, not evidence of TaskCreate/Update or native plan mode.
export const PLAN_ITEMS = 12;
export const PLAN_REVISIONS = PLAN_ITEMS + 1;
export const planItems = (revision: number) => Array.from({ length: PLAN_ITEMS }, (_, index) => ({
  content: `Captured step ${String(index + 1).padStart(2, '0')}`,
  status: index < revision ? 'completed' : index === revision ? 'in_progress' : 'pending',
  activeForm: `Working on step ${index + 1}`,
}));

const base = (cwd: string, session: string) => ({ cwd, sessionId: session, timestamp: '2026-10-27T00:00:00Z' });
export const planPrompt = (cwd: string, session: string) => ({
  ...base(cwd, session), type: 'user', uuid: 'living-prompt',
  message: { role: 'user', content: 'Follow the twelve captured steps' },
});
export const planRows = (cwd: string, session: string, revision: number) => [
  { ...base(cwd, session), type: 'assistant', uuid: `living-a-${revision}`, message: {
    id: `living-m-${revision}`, role: 'assistant', content: [
      { type: 'tool_use', id: `living-todo-${revision}`, name: 'TodoWrite', input: { todos: planItems(revision) } },
    ],
  } },
  { ...base(cwd, session), type: 'user', uuid: `living-r-${revision}`, message: {
    role: 'user', content: [{ type: 'tool_result', tool_use_id: `living-todo-${revision}`, content: 'Captured list updated' }],
  } },
];
