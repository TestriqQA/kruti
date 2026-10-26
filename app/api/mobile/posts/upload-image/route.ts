import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { getMobileUserId } from "@/lib/mobileAuth";
import { checkRateLimit } from "@/lib/rate-limit";
import { appendImageHistory } from "@/lib/image-history";

export const maxDuration = 60;

/**
 * POST /api/mobile/posts/upload-image  (multipart: "postId" + "image")
 *
 * The app editor's "upload from phone" button. Same behaviour as the website's
 * /api/upload/image - replaces the post's image, keeps the previous one in the
 * reusable history, and clears any attached document, since a post carries
 * either an image or a PDF but not both.
 *
 * Two differences from the website route, both deliberate:
 *
 *  - the filename extension is sanitised. The website takes whatever follows
 *    the last dot in the uploaded name and puts it straight into the blob path;
 *    a name like "x.png/../evil" ends up shaping that path. Harmless in its own
 *    namespace, but not worth copying into a new endpoint.
 *
 *  - a rate limit, which the website route does not have. 60 an hour is far
 *    above any real editing session and keeps a stuck client from filling blob
 *    storage. It reports rateLimited and retryAfterSecs, like the other mobile
 *    routes.
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(userId, "mobile-image-upload", {
      maxRequests: 60,
      windowSecs: 3600,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many uploads. Try again in ${rl.retryAfterSecs}s.`,
          rateLimited: true,
          retryAfterSecs: rl.retryAfterSecs,
        },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    if (!postId) {
      return NextResponse.json({ error: "No postId provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 });
    }

    // Scoped to the caller, so one user cannot attach an image to another
    // user's post. A bare findUnique by id would not do that.
    const post = await prisma.post.findFirst({
      where: { id: postId, plan: { userId } },
      select: { id: true, imageHistory: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const ext = (file.name.split(".").pop() ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "png";
    const blob = await put(`uploads/upload-${post.id}-${Date.now()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    });

    await prisma.post.update({
      where: { id: post.id },
      data: {
        imageUrl: blob.url,
        imageHistory: appendImageHistory(post.imageHistory, [blob.url]),
        documentUrl: null,
        documentName: null,
      },
    });

    return NextResponse.json({ imageUrl: blob.url });
  } catch (err) {
    console.error("[mobile/posts/upload-image] failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
