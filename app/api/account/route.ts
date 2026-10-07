import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eraseUserCompletely } from "@/lib/account-deletion";

/**
 * Self-service account deletion (DPDP s.12(3), right to erasure).
 *
 * Before this existed, `prisma.user.delete` appeared exactly once in the whole
 * codebase, behind requireAdmin - so a user could not erase their own account at
 * all, and the privacy policy's deletion promise depended on someone emailing
 * support. A right that requires asking permission is not a right.
 *
 * Deliberately NOT subscription-gated: a lapsed trial cannot be a reason to hold
 * someone's personal data.
 *
 * Confirmation is required in the body rather than relying on the UI, because
 * this is irreversible and a stray DELETE must not destroy an account.
 */

const CONFIRMATION = "DELETE MY ACCOUNT";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body?.confirm !== CONFIRMATION) {
    return NextResponse.json(
      { error: `To confirm, send { "confirm": "${CONFIRMATION}" }.` },
      { status: 400 }
    );
  }

  // An admin deleting themselves would leave the admin surface unreachable, and
  // the account is almost certainly the operator's own rather than a data
  // subject exercising a right.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted from here. Contact support@kruti.io." },
      { status: 403 }
    );
  }

  const result = await eraseUserCompletely(user.id);

  // The session is a JWT, so it is not invalidated server-side by this. The
  // client signs out immediately afterwards; any request it made in between
  // would 401 anyway, because every route resolves the user from the database.
  return NextResponse.json({
    success: true,
    message: "Your account and all associated data have been permanently deleted.",
    filesDeleted: result.blobsDeleted,
  });
}
