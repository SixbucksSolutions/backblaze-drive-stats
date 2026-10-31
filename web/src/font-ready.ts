export type FontMode = 'custom' | 'fallback';
export type FontSet = { load: (font: string, text?: string) => Promise<unknown[]>; ready: PromiseLike<unknown> };
export const REQUIRED_FONTS = ['400 14px Inter', '400 13px "JetBrains Mono"', '600 13px "JetBrains Mono"'] as const;

/** A timeout chooses a permanent per-page fallback; late downloads never swap it. */
export async function waitForFonts(fonts: FontSet | undefined, timeoutMs = 5000): Promise<FontMode> {
  if (!fonts) return 'fallback';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loaded = Promise.resolve().then(async (): Promise<FontMode> => {
    const faces = await Promise.all(REQUIRED_FONTS.map(font => fonts.load(font, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')));
    if (faces.some(list => list.length === 0)) return 'fallback';
    await fonts.ready;
    return 'custom';
  }).catch((): FontMode => 'fallback');
  const timeout = new Promise<FontMode>(resolve => { timer = setTimeout(() => resolve('fallback'), timeoutMs); });
  try { return await Promise.race([loaded, timeout]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Keep the initial view hidden until both data/rendering and fonts settle. */
export async function waitForPresentation(fonts: Promise<FontMode>, rendering: Promise<unknown>) {
  const [font, render] = await Promise.allSettled([fonts, rendering]);
  return { fontMode: font.status === 'fulfilled' ? font.value : 'fallback' as FontMode, renderFailed: render.status === 'rejected' };
}

/** A stalled code chunk must not keep initial content invisible indefinitely. */
export async function withStartupDeadline(render: () => Promise<unknown>, controller: AbortController, timeoutMs = 15000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Initial rendering deadline exceeded')); }, timeoutMs);
  });
  try { return await Promise.race([Promise.resolve().then(render), expired]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
