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

/** Thrown to end a run early with a user-facing message. */
export class StreamAbort extends Error {
  constructor(message: string, readonly extra: StreamEvent = {}) {
    super(message);
    this.name = "StreamAbort";
  }
}
