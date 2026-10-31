type Control = {
  id: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectionDirection?: 'forward' | 'backward' | 'none' | null;
  focus(options?: { preventScroll: boolean }): void;
  setSelectionRange?(start: number, end: number, direction?: 'forward' | 'backward' | 'none'): void;
};
export type ControlFocus = {
  id: string;
  selection?: { start: number; end: number; direction: 'forward' | 'backward' | 'none' };
};
export function captureControlFocus(control: Control | null): ControlFocus | undefined {
  if (!control?.id) {
    return undefined;
  }
  const { selectionStart: start, selectionEnd: end, selectionDirection: direction } = control;
  return {
    id: control.id,
    ...(typeof start === 'number' && typeof end === 'number'
      ? { selection: { start, end, direction: direction ?? 'none' } }
      : {}),
  };
}
export function restoreControlFocus(
  saved: ControlFocus | undefined,
  find: (id: string) => Control | null,
) {
  if (!saved) {
    return;
  }
  const control = find(saved.id);
  if (!control) {
    return;
  }
  control.focus({ preventScroll: true });
  if (saved.selection && control.setSelectionRange) {
    control.setSelectionRange(
      saved.selection.start,
      saved.selection.end,
      saved.selection.direction,
    );
  }
}
export const controlId = (scope: string, key: string) =>
  `matrix-${scope}-${encodeURIComponent(key)}`;
