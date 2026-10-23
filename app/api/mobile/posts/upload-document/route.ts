/**
 * POST /api/mobile/posts/upload-document  (multipart/form-data)
 * Fields: postId, document (a PDF file)
 *
 * Uploads a PDF to Blob storage and saves it on the post as documentUrl +
 * documentName. The post then publishes to LinkedIn as a document/carousel
 * post (swipeable PDF), same as LinkedIn's native document posts.
 *
 * Place at: app/api/mobile/posts/upload-document/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB (LinkedIn document limit is ~100MB)

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("document") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file)
      return NextResponse.json({ error: "No document provided" }, { status: 400 });
    if (!postId)
      return NextResponse.json({ error: "No postId provided" }, { status: 400 });

    const post = await prisma.post.findFirst({
      where: { id: postId, plan: { userId } },
    });
    if (!post)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Only PDFs (LinkedIn document posts accept PDF).
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf)
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );

    if (file.size > MAX_BYTES)
      return NextResponse.json(
        { error: "PDF too large. Maximum size is 25MB" },
        { status: 400 },
      );

    const safeName = (file.name || "document.pdf").replace(/[^\w.\-]+/g, "_");
    const blob = await put(`documents/doc-${postId}-${Date.now()}.pdf`, file, {
      access: "public",
      contentType: "application/pdf",
    });

    await prisma.post.update({
      where: { id: postId },
      data: { documentUrl: blob.url, documentName: safeName },
    });

    return NextResponse.json({
      documentUrl: blob.url,
      documentName: safeName,
    });
  } catch (err) {
    console.error("[upload-document] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// Remove the attached document from a post.
export async function DELETE(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");
  if (!postId)
    return NextResponse.json({ error: "No postId provided" }, { status: 400 });

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId } },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await prisma.post.update({
    where: { id: postId },
    data: { documentUrl: null, documentName: null },
  });

  return NextResponse.json({ ok: true });
}
