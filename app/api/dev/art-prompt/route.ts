import { NextRequest, NextResponse } from "next/server";
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
 *   /api/dev/art-prompt              - most recent post that has an image
 *   /api/dev/art-prompt?postId=xxx   - a specific post
 *   /api/dev/art-prompt?count=3      - the three most recent
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const postId = req.nextUrl.searchParams.get("postId");
  const count = Math.min(Number(req.nextUrl.searchParams.get("count") ?? 1) || 1, 5);

  const posts = postId
    ? await prisma.post.findMany({ where: { id: postId }, take: 1, ...SELECT })
    : await prisma.post.findMany({
        where: { imageUrl: { not: null } },
        orderBy: { createdAt: "desc" },
        take: count,
        ...SELECT,
      });

  if (posts.length === 0) {
    return NextResponse.json({ error: "No matching post found." }, { status: 404 });
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
        "Recraft tops out at 1024x1024 on 1:1, so set Gemini to 1K for a fair test.",
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
    imageStyle: true,
    imageUrl: true,
    imagePrompt: true,
  },
} as const;
