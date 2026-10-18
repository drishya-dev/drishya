export interface FollowUp {
    after: number;
    operationId?: string;
    path?: string;
}
const sources = new WeakMap<object, Map<string, FollowUp>>();
export function followUp(source: object, id: string) { return sources.get(source)?.get(id); }
/** Navigation metadata only. Preparation is not submission or a causal link. */
export function rememberFollowUp(source: object, id: string, value: FollowUp) {
    let items = sources.get(source);
    if (!items) {
        items = new Map();
        sources.set(source, items);
    }
    items.delete(id);
    items.set(id, value);
    while (items.size > 8)
        items.delete(items.keys().next().value!);
    window.dispatchEvent(new Event('drishya-followup-prepared'));
}
