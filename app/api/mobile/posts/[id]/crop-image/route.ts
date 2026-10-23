/**
 * POST /api/mobile/posts/[id]/crop-image
 *
 * "Crop Images" — re-processes the post image(s) so LinkedIn no longer shows
 * the "AI" content tag. AI image generators embed provenance metadata (C2PA /
 * SynthID); LinkedIn reads it and labels the post as AI-generated. Re-encoding
 * the image with sharp (and trimming a few pixels) strips that metadata, so the
 * tag is removed. Works on the single image AND the carousel `images` array.
 *
 * Place at: app/api/mobile/posts/[id]/crop-image/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export const maxDuration = 60;

// Fetch an image, trim a few pixels off each edge, and re-encode it (which
// strips ALL embedded metadata / AI provenance). Returns the new public URL.
async function cropAndReupload(
  url: string,
  postId: string,
  i: number,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    // Crop just 1px off each edge — imperceptible (same as the website). The
    // re-encode below is what actually strips the AI metadata; this 1px keeps
    // the image visually identical, NOT a real crop.
    const inset = 1;

    let pipeline = sharp(buf);
    if (w > inset * 2 + 2 && h > inset * 2 + 2) {
      pipeline = pipeline.extract({
        left: inset,
        top: inset,
        width: w - inset * 2,
        height: h - inset * 2,
      });
    }
    // Re-encode as JPEG WITHOUT .withMetadata() → all EXIF/C2PA metadata is
    // dropped, so LinkedIn's AI detection has nothing to read.
    const out = await pipeline.jpeg({ quality: 92 }).toBuffer();

    const blob = await put(
      `cropped/post-${postId}-${i}-${Date.now()}.jpg`,
      out,
      { access: "public", contentType: "image/jpeg" },
    );
    return blob.url;
  } catch (err) {
    console.error("[crop-image] failed for", url, err);
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Collect the image URLs to process — carousel array, else the single image.
  let urls: string[] = [];
  if (post.carouselImages) {
    try {
      const parsed = JSON.parse(post.carouselImages);
      if (Array.isArray(parsed))
        urls = parsed.filter(
          (u): u is string => typeof u === "string" && u.startsWith("https://"),
        );
    } catch {
      /* ignore */
    }
  }
  if (urls.length === 0 && post.imageUrl?.startsWith("https://")) {
    urls = [post.imageUrl];
  }
  if (urls.length === 0)
    return NextResponse.json(
      { error: "No image to crop on this post." },
      { status: 400 },
    );

  const newUrls: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const u = await cropAndReupload(urls[i], post.id, i);
    newUrls.push(u ?? urls[i]); // keep the original if a crop fails
  }

  const isCarousel = urls.length > 1;
  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      imageUrl: newUrls[0],
      ...(isCarousel ? { carouselImages: JSON.stringify(newUrls) } : {}),
    },
  });

  return NextResponse.json({
    imageUrl: updated.imageUrl,
    images: newUrls,
  });
}
