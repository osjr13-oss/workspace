/**
 * Reveals a streamed reply at a steady pace.
 *
 * Groq is fast and its text arrives in bursts of a few hundred characters, so
 * painting each burst as it lands makes a reply jump forward in chunks. The
 * pacer instead shows a few more characters every frame: never slower than a
 * comfortable reading speed, and fast enough to stay at most CATCH_UP_MS behind
 * what has arrived.
 *
 * Shared with the iPhone app (mobile/), so it uses no browser-only APIs.
 */

const MIN_CHARS_PER_MS = 0.06; // about 60 characters a second
const CATCH_UP_MS = 380;
// A hidden tab does not run animation frames; a finished reply is shown in full after this long.
const FINISH_TIMEOUT_MS = 2_500;

export type StreamPacer = {
  push: (text: string) => void;
  /** The part of the reply on screen right now. */
  shown: () => string;
  /** Resolves once everything that arrived is on screen. */
  finish: () => Promise<void>;
  cancel: () => void;
};

export function createStreamPacer(onShow: (text: string) => void): StreamPacer {
  let received = "";
  let shownLength = 0;
  let frame = 0;
  let lastAt = 0;
  let drained: (() => void) | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const settle = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    drained?.();
    drained = null;
  };

  const tick = (now: number) => {
    frame = 0;
    const elapsed = lastAt ? Math.min(now - lastAt, 64) : 16;
    lastAt = now;
    const backlog = received.length - shownLength;
    if (backlog > 0) {
      const rate = Math.max(MIN_CHARS_PER_MS, backlog / CATCH_UP_MS);
      shownLength = Math.min(received.length, shownLength + Math.max(1, Math.round(rate * elapsed)));
      onShow(received.slice(0, shownLength));
    }
    if (shownLength < received.length) {
      frame = requestAnimationFrame(tick);
    } else {
      lastAt = 0;
      settle();
    }
  };

  return {
    push(text) {
      if (!text) return;
      received += text;
      if (!frame) frame = requestAnimationFrame(tick);
    },
    shown: () => received.slice(0, shownLength),
    finish() {
      if (shownLength >= received.length) return Promise.resolve();
      return new Promise<void>((resolve) => {
        drained = resolve;
        timeout = setTimeout(() => {
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
          shownLength = received.length;
          onShow(received);
          settle();
        }, FINISH_TIMEOUT_MS);
        if (!frame) frame = requestAnimationFrame(tick);
      });
    },
    cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      settle();
    }
  };
}
