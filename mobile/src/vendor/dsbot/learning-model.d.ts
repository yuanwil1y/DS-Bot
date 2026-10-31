export type DiffRow = { kind: 'added' | 'removed' | 'same'; line: string; number?: number };
export function lineDiff(before?: string, after?: string): DiffRow[];
export function editLines(text?: string): string[];
