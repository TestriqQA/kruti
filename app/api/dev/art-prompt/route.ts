import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getImageBrief } from "@/lib/image-brief";
import { resolveImageCategory } from "@/lib/image-categories";
import { buildArtImagePrompt } from "@/lib/imagen";
import { resolveVisualStyle, resolvePageLayout } from "@/lib/image-styles";
import { resolveTheme } from "@/lib/image-themes";
import { RECRAFT_MODELS } from "@/lib/recraft";

export const maxDuration = 60;

/**
 * DEV ONLY. 404s in production.
 *
 * Hands back the REAL prompt a post's image was drawn from, so it can be pasted
 * into another provider's playground and the two outputs compared fairly.
 *
 * This exists because Post.imagePrompt is NOT that prompt - the route stores a
 * summary ("[Checklist Card] | bold-editorial | headline | scene"), while the
 * string actually sent to the model is assembled by buildArtImagePrompt and
 * never persisted. Comparing providers on the summary would hand the challenger
 * a worse brief than the incumbent ever got, and the result would mean nothing.
 *
 * The brief is regenerated rather than recovered, because the fields that shape
 * the prompt - nodes, statLine, subhead, chips - are not stored either. That
 * costs one cheap text call per post. No image model is called here.
 *
 *   /api/dev/art-prompt              - newest post that already has an image
 *   /api/dev/art-prompt?any=1        - newest post, image or not
 *   /api/dev/art-prompt?postId=xxx   - a specific post
 *   /api/dev/art-prompt?count=3      - the three newest
 *
 * The default skips posts with no image because the point is to compare a new
 * provider against the picture this one actually produced. That does mean the
 * newest post can be skipped if nobody has generated its image yet, which is
 * why every result carries its createdAt - an old post should be obvious
 * rather than quietly served as "the latest".
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Scoped to the caller. Without this the newest post in the whole database
  // wins, which on a shared dev database is somebody else's - it hands back
  // their post body and prompt, and the id it returns 404s when the caller
  // opens it, because /posts/[id] is scoped even though this was not.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const mine = { plan: { userId: session.user.id } };

  const postId = req.nextUrl.searchParams.get("postId");
  const count = Math.min(Number(req.nextUrl.searchParams.get("count") ?? 1) || 1, 5);
  const any = req.nextUrl.searchParams.get("any") === "1";

  const posts = postId
    ? await prisma.post.findMany({ where: { id: postId, ...mine }, take: 1, ...SELECT })
    : await prisma.post.findMany({
        where: any ? mine : { ...mine, imageUrl: { not: null } },
        orderBy: { createdAt: "desc" },
        take: count,
        ...SELECT,
      });

  if (posts.length === 0) {
    return NextResponse.json(
      { error: "No post of yours matched. Try ?any=1 if none of them has an image yet." },
      { status: 404 }
    );
  }

  const out = [];
  for (const post of posts) {
    const category = resolveImageCategory(post.imageStyle);
    const brief = await getImageBrief(
      { title: post.title, body: post.body, postType: post.postType },
      category
    );

    // Exactly what generateAndStoreArtImage assembles before it calls the model.
    const style = resolveVisualStyle(brief.visualStyle, post.id);
    const theme = resolveTheme(brief.themeId, post.id);
    const layout = resolvePageLayout(brief.layout, post.id);

    const prompt = buildArtImagePrompt({
      scene: brief.scene || `A clear, concrete scene representing: ${brief.headline ?? category.label}`,
      headline: brief.headline ?? "",
      labels: style.textLoad === "low" ? [] : brief.nodes ?? [],
      statLine: brief.statLine,
      subhead: brief.subhead,
      chips: brief.chips,
      layoutDirection: layout.direction,
      subject: brief.subject,
      brands: brief.brands,
      styleDirection: style.direction,
      styleName: style.name,
      textLoad: style.textLoad,
      palette: { phrase: theme.palettePhrase, mode: theme.mode },
      formatLabel: category.label,
    });

    out.push({
      postId: post.id,
      createdAt: post.createdAt.toISOString(),
      hook: post.title,
      imageStyle: post.imageStyle ?? "(none set - fell back to the default)",
      categoryLabel: category.label,
      // The picture this prompt produced on the current provider, to judge against.
      currentImageUrl: post.imageUrl,
      storedSummary: post.imagePrompt,
      promptChars: prompt.length,
      // A prompt over a model's ceiling is trimmed before it is sent, so this
      // says up front whether the comparison is even like-for-like.
      fitsRecraftV3: prompt.length <= RECRAFT_MODELS["recraft-v3"].maxPromptChars,
      fitsRecraftFlash: prompt.length <= RECRAFT_MODELS["recraft-v4.1-flash"].maxPromptChars,
      degradedBrief: brief.degraded ?? false,
      prompt,
    });
  }

  return NextResponse.json(
    {
      note:
        "Paste `prompt` into the other provider. Compare its output against `currentImageUrl`. " +
        "Recraft tops out at 1024x1024 on 1:1, so set Gemini to 1K for a fair test. " +
        "Check createdAt - the default skips posts that have no image yet, so add ?any=1 for the newest post regardless.",
      posts: out,
    },
    { status: 200 }
  );
}

const SELECT = {
  select: {
    id: true,
    title: true,
    body: true,
    postType: true,
    createdAt: true,
    imageStyle: true,
    imageUrl: true,
    imagePrompt: true,
  },
} as const;
