import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTextWithConfig, parseJSON } from "@/lib/gemini";
import { buildVariantPostPrompt, VARIANT_STYLE_NAMES } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkProfileReady } from "@/lib/profile-guard";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface GeneratedVariant {
  title: string;
  body: string;
  hashtags: string[];
  imagePrompt: string;
}

const VARIANT_TEMPERATURES = [0.7, 0.9, 0.8];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  // Content-quality gate. This route writes from buildProfileContext(), so a
  // thin profile just produces another generic draft - the same complaint the
  // user already has. Blocked with the specific gaps so the client can link
  // straight to the fix.
  const profile = await checkProfileReady(session.user.id);
  if (!profile.ready) {
    return NextResponse.json(
      { error: profile.message, profileIncomplete: true, gaps: profile.gaps },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(session.user.id, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();
  const { postId } = body;

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
    include: { plan: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get week theme from strategy
  const strategy = JSON.parse(post.plan.strategy) as {
    weekTheme?: string;
    weeks?: Array<{ weekNumber: number; theme: string }>;
  };
  const weekTheme =
    strategy.weekTheme ??
    strategy.weeks?.find((w) => w.weekNumber === post.weekNumber)?.theme ??
    "Professional Insights";

  // Determine effective human mode
  const effectiveHumanMode =
    post.humanModeOverride !== null && post.humanModeOverride !== undefined
      ? post.humanModeOverride
      : (user.humanMode ?? false);

  const profileContext = buildProfileContext(user);

  try {
    // Generate 3 variants in parallel with different styles and temperatures
    const variantPromises = VARIANT_STYLE_NAMES.map((style, i) => {
      const prompt = buildVariantPostPrompt(
        profileContext,
        post.title,
        post.postType,
        weekTheme,
        style,
        effectiveHumanMode
      );
      return generateTextWithConfig(prompt, {
        temperature: VARIANT_TEMPERATURES[i],
      }).then((raw) => {
        const parsed = parseJSON<GeneratedVariant>(raw);
        return { ...parsed, style };
      });
    });

    const variants = await Promise.all(variantPromises);
    return NextResponse.json({ variants });
  } catch (err) {
    console.error("Variant generation error:", err);
    return NextResponse.json({ error: "Failed to generate variants" }, { status: 500 });
  }
}
