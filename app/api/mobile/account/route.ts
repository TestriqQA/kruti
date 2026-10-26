import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { eraseUserCompletely } from "@/lib/account-deletion";

/**
 * DELETE /api/mobile/account
 * Body: { "confirm": "DELETE MY ACCOUNT" }
 *
 * The mobile face of /api/account. Same erasure path, same rules; only the
 * authentication differs, because the app carries a Bearer JWT rather than a
 * session cookie.
 *
 * The confirmation string is kept deliberately. This is irreversible and
 * unrecoverable, so a stray DELETE - a retried request, a mis-wired button -
 * must not destroy an account. Google Play requires the deletion route to
 * exist, not that it fire on an empty body.
 *
 * Not subscription-gated, same as the website: a lapsed trial cannot be a
 * reason to hold someone's personal data (DPDP s.12(3)).
 */

const CONFIRMATION = "DELETE MY ACCOUNT";

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (body?.confirm !== CONFIRMATION) {
      return NextResponse.json(
        { error: `To confirm, send { "confirm": "${CONFIRMATION}" }.` },
        { status: 400 },
      );
    }

    // An admin erasing themselves would leave the admin surface unreachable,
    // and the account is almost certainly the operator's own rather than a data
    // subject exercising a right.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted from here. Contact support@kruti.io." },
        { status: 403 },
      );
    }

    const result = await eraseUserCompletely(user.id);

    // The app's token is a JWT, so it is not invalidated server-side by this.
    // The app should discard it and return to sign-in; any request it made in
    // between would 401 anyway, because every route resolves the user from the
    // database.
    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
      filesDeleted: result.blobsDeleted,
    });
  } catch (err) {
    console.error("[mobile/account] delete failed:", err);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }
}
