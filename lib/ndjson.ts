/**
 * NDJSON streaming helper.
 *
 * Long generation routes emit one JSON object per line so the client can render
 * the pipeline as it happens instead of staring at a spinner. Same wire format
 * the carousel route established: `{"type":"...","status":"..."}\n`.
 *
 * The handler receives `send`; returning (or throwing) closes the stream. Errors
 * are reported as a final `{type:"error"}` event rather than a dead connection,
 * so the client always learns why a run stopped.
 */
export type StreamEvent = Record<string, unknown>;
export type SendFn = (event: StreamEvent) => void;

export function ndjsonResponse(
  run: (send: SendFn) => Promise<void>,
  onError: (err: unknown) => string = (err) =>
    (err as Error)?.message || "Something went wrong"
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: SendFn = (event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await run(send);
      } catch (err) {
        console.error("[stream] run failed:", err);
        send({ type: "error", message: onError(err) });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Stops proxies buffering the stream, which would defeat the point.
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * True when the caller has hung up, in which case the run should stop.
 *
 * Aborting a fetch in the browser closes the connection, which aborts the
 * route handler's `request.signal`. Without this nothing watches that: the
 * run carried on to completion, saved its result and charged the user for a
 * generation they had explicitly cancelled.
 *
 * Checked at two kinds of place - before anything expensive, so a cancel that
 * arrives in time costs nothing at all, and immediately before the database
 * write, which is the point that actually charges someone.
 *
 * The terminal event is for the buffered caller's benefit. A cancelled
 * streaming caller is by definition no longer listening, but respondByAccept
 * still needs one terminal event or it reports the run as broken.
 */
export function stopIfCancelled(
  signal: AbortSignal | undefined,
  send: SendFn,
): boolean {
  if (!signal?.aborted) return false;
  // 499 is the conventional 'client closed request'. Nothing will read it on
  // the stream path; it keeps the buffered path from answering a bare 500.
  send({
    type: "error",
    message: "Cancelled",
    cancelled: true,
    status: 499,
  });
  return true;
}

/** Thrown to end a run early with a user-facing message. */
export class StreamAbort extends Error {
  constructor(message: string, readonly extra: StreamEvent = {}) {
    super(message);
    this.name = "StreamAbort";
  }
}
