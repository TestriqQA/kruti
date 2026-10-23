/**
 * GET /api/mobile/newsletters
 * Lists the user's newsletters, parsed into the mobile card shape.
 *
 * Place at: app/api/mobile/newsletters/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.newsletter.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // The DB stores the full generated newsletter JSON in `body`.
  // Parse it into the structured shape the mobile screen expects.
  const newsletters = rows.map((n) => {
    let parsed: {
      title?: string;
      subject?: string;
      intro?: { hook?: string; preview?: string };
      sections?: Array<{
        heading?: string;
        content?: string;
        keyTakeaway?: string;
      }>;
      featuredInsight?: { quote?: string; context?: string };
      cta?: { heading?: string; text?: string; action?: string };
      signoff?: string;
    } = {};
    try {
      parsed = JSON.parse(n.body);
    } catch {
      /* body may be plain text */
    }

    return {
      id: n.id,
      title: parsed.title || n.title,
      subjectLine: parsed.subject || n.subject || "",
      status: n.status,
      scheduledAt: n.scheduledAt ? n.scheduledAt.toISOString() : null,
      introHook: parsed.intro?.hook || "",
      preview: parsed.intro?.preview || "",
      sections: (parsed.sections || []).map((s) => ({
        heading: s.heading,
        body: s.content,
        takeaway: s.keyTakeaway,
      })),
      // Send the editable pieces UNCONCATENATED. Joining quote+context (or
      // heading+text) made the round-trip lossy: the app could not split them
      // apart again on save, so the nested shape was destroyed.
      featuredInsight: parsed.featuredInsight?.quote || "",
      // The three CTA pieces separately, so the app can show/edit each like
      // the website (previously heading + action were folded away and lost).
      ctaHeading: parsed.cta?.heading || "",
      ctaText: parsed.cta?.text || "",
      ctaAction: parsed.cta?.action || "",
      signoff: parsed.signoff || "",
      // The full nested content exactly as stored. The app rebuilds this shape
      // on save (overriding only what it edits) instead of writing its own flat
      // shape over the top — which used to break the web editor and the email send.
      raw: parsed,
      createdAt: n.createdAt,
    };
  });

  return NextResponse.json({ newsletters });
}
