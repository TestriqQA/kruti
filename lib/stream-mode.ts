import { NextRequest, NextResponse } from "next/server";
import { ndjsonResponse, type SendFn, type StreamEvent } from "@/lib/ndjson";

/**
 * Content negotiation for the generation pipelines.
 *
 * The same run produces either NDJSON progress or one buffered JSON response,
 * decided by the caller's Accept header. The website always wants the stream,
 * so it can draw the pipeline; the mobile app wants the stream on the long runs
 * and one response on the short ones, and asks per request.
 *
 * This is only possible because every pipeline already ends in exactly one
 * terminal event:
 *
 *   { type: "done",  ...payload }           -> 200 with payload
 *   { type: "error", message, ...flags }    -> status derived from the flags
 *
 * Everything else a run emits - preflight, progress, per-item events - is
 * progress reporting and is discarded in buffered mode.
 *
 * Authentication is deliberately NOT handled here. A caller must resolve the
 * user and return 401 itself, BEFORE calling this, so an auth failure is always
 * an HTTP status rather than a sentinel event buried in a 200 stream. That was
 * agreed with the app side and it is also just correct: there is nothing to
 * stream to someone we have not identified.
 */

const NDJSON_TYPE = "application/x-ndjson";

/** True when the caller asked for the stream rather than one response. */
export function wantsNdjson(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").toLowerCase().includes(NDJSON_TYPE);
}

/**
 * Maps a terminal error event onto an HTTP status for a buffered caller.
 *
 * The flags are the same ones the non-streaming routes already set, so a client
 * branches on `subscriptionRequired` / `profileIncomplete` / `rateLimited`
 * identically whichever transport it used.
 */
function statusForError(event: StreamEvent): number {
  if (event.subscriptionRequired) return 403;
  if (event.profileIncomplete) return 403;
  if (event.rateLimited) return 429;
  // A run may set `status` when it knows better than this default - "not found"
  // and "bad input" both arrive as plain error events otherwise.
  if (typeof event.status === "number") return event.status;
  return 500;
}

export async function respondByAccept(
  req: NextRequest,
  run: (send: SendFn) => Promise<void>,
  onError: (err: unknown) => string = () => "Something went wrong",
): Promise<Response> {
  if (wantsNdjson(req)) {
    return ndjsonResponse(run, onError);
  }

  const events: StreamEvent[] = [];
  const send: SendFn = (event) => {
    events.push(event);
  };

  try {
    await run(send);
  } catch (err) {
    // Matches ndjsonResponse's behaviour: a thrown run is reported, not a dead
    // connection. Detail to the log, generic message to the caller.
    console.error("[stream-mode] run failed:", err);
    return NextResponse.json({ error: onError(err) }, { status: 500 });
  }

  // Last wins. A run that errors after partial progress has emitted earlier
  // events we do not want to answer with.
  const failure = [...events].reverse().find((e) => e.type === "error");
  if (failure) {
    // `type` and `status` are transport concerns, not part of the body contract.
    const { type: _t, status: _s, message, ...flags } = failure;
    return NextResponse.json(
      { error: message ?? "Something went wrong", ...flags },
      { status: statusForError(failure) },
    );
  }

  const done = [...events].reverse().find((e) => e.type === "done");
  if (done) {
    const { type: _t, ...payload } = done;
    return NextResponse.json(payload);
  }

  // Neither terminal event means the run returned without finishing, which is a
  // bug in the run rather than anything the caller did.
  console.error("[stream-mode] run emitted neither done nor error");
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
