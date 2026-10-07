import { eraseUserCompletely } from "@/lib/account-deletion";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      subscription: true,
      _count: { select: { contentPlans: true, newsletters: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if ("role" in body) {
    if (params.id === session!.user.id && body.role !== "admin") {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
    }
    updateData.role = body.role;
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  if (params.id === session!.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  // `mode` is REQUIRED, with no default.
  //
  // It used to default to "data", which deletes posts, plans and newsletters but
  // KEEPS the User row, the Subscription, every support ticket and the Account
  // row holding the user's LinkedIn access and refresh tokens. An erasure
  // request executed as a bare DELETE therefore did not erase the data subject -
  // a direct failure under DPDP s.12(3). Making the caller state their intent is
  // the fix: there is no longer a quiet wrong answer.
  if (mode !== "full" && mode !== "data") {
    return NextResponse.json(
      {
        error:
          'mode is required: "full" erases the account and all personal data; "data" clears generated content but keeps the account, subscription, support tickets and LinkedIn tokens.',
      },
      { status: 400 }
    );
  }

  if (mode === "full") {
    const result = await eraseUserCompletely(params.id);
    return NextResponse.json({ success: true, mode, ...result });
  }

  // Content only - the account, subscription and credentials deliberately remain.
  await prisma.$transaction([
    prisma.post.deleteMany({ where: { plan: { userId: params.id } } }),
    prisma.contentPlan.deleteMany({ where: { userId: params.id } }),
    prisma.newsletter.deleteMany({ where: { userId: params.id } }),
  ]);

  return NextResponse.json({ success: true, mode });
}
