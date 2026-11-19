import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/linkedin-token";
import { shouldShowWatermark, WATERMARK_TEXT } from "@/lib/subscription-check";
import { formatPostBody, cleanInline } from "@/lib/format";
import { imagesToPdf } from "@/lib/images-to-pdf";

// Versioned LinkedIn REST APIs (documents + posts) require this month header.
const LINKEDIN_VERSION = "202601";

/**
 * Escape the Posts API "little text" reserved characters so literal post text can
 * never parse as a mention/template (unescaped ( ) [ ] { } @ etc. can 400 or render
 * wrong). '#' is deliberately NOT escaped so hashtags keep working. Only used for
 * the versioned /rest/posts commentary - the legacy ugcPosts path does not use
 * little text and stays unescaped.
 */
function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`);
}

export interface LinkedInPostResult {
  success: boolean;
  linkedinPostId?: string;
  error?: string;
  requiresReauth?: boolean;
  /** LinkedIn's own HTTP status when it refused the post. */
  linkedinStatus?: number;
  /**
   * Set when LinkedIn refused the post as a duplicate and named the share it
   * already has. That URN IS the post, so this is a recoverable refusal: the
   * content is live and our record of it is simply out of date.
   */
  duplicateOf?: string;
}

/**
 * Turn LinkedIn's HTTP status into something the person reading the screen can
 * act on.
 *
 * Every non-401 refusal used to come back as "Failed to post to LinkedIn.
 * Please try again later." - the same sentence for a missing permission, a
 * duplicate, LinkedIn rate limiting the account and LinkedIn being down. Four
 * different problems with four different answers, and the screen could not
 * tell them apart, so every report had to go to the server logs before anyone
 * could even start.
 */
function linkedInErrorMessage(status: number, body: string): string {
  if (status === 403)
    return "LinkedIn refused the post. The posting permission is missing or was withdrawn - sign out and sign in again to grant it.";
  if (status === 422)
    return "This post is already on LinkedIn - LinkedIn refused it as a duplicate.";
  if (status === 429)
    return "LinkedIn is rate limiting this account. Wait a while before trying again.";
  if (status >= 500)
    return "LinkedIn is having trouble right now. Try again in a few minutes.";
  // Anything else: carry the status and a short slice of LinkedIn's own words,
  // because an unrecognised failure is exactly the one worth seeing verbatim.
  const detail = (body || "").replace(/\s+/g, " ").trim().slice(0, 200);
  return `LinkedIn refused the post (HTTP ${status})${detail ? `: ${detail}` : "."}`;
}

export async function postToLinkedIn(
  userId: string,
  post: {
    title?: string | null;   // Hook / opening line - prepended with line breaks
    body: string;
    hashtags: string | null;
    imageUrl: string | null;
    carouselImages?: string[] | null; // multiple images → multi-image (carousel) post
    documentUrl?: string | null; // PDF → LinkedIn document (swipeable PDF carousel) post
    documentName?: string | null;
    customSignature?: string | null;
  }
): Promise<LinkedInPostResult> {
  // Get a valid (auto-refreshed if needed) LinkedIn access token
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      error: "LinkedIn access token expired. Please sign out and sign in again to reconnect.",
      requiresReauth: true,
    };
  }

  // Get LinkedIn user ID - prefer user.linkedinId, fall back to account.providerAccountId
  const account = await prisma.account.findFirst({
    where: { userId, provider: "linkedin" },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  const linkedinId = user?.linkedinId || account?.providerAccountId;
  if (!linkedinId) {
    return { success: false, error: "No LinkedIn ID found. Please sign out and sign in again." };
  }

  // Backfill linkedinId silently if it was missing
  if (!user?.linkedinId && account?.providerAccountId) {
    prisma.user.update({
      where: { id: userId },
      data: { linkedinId: account.providerAccountId },
    }).catch(() => null);
  }

  // Build full post text: hook → body → hashtags → signature
  const hashtags = post.hashtags ? (JSON.parse(post.hashtags) as string[]) : [];
  const parts: string[] = [];

  // Hook / opening line - with one blank line below it, separating it from the body.
  const hook = cleanInline(post.title);
  if (hook) {
    parts.push(hook);
    parts.push("");
  }

  // Main body (markdown stripped, list items spaced)
  parts.push(formatPostBody(post.body));

  // Hashtags
  if (hashtags.length > 0) {
    parts.push("");
    parts.push(hashtags.map((h) => `#${h}`).join(" "));
  }

  // User's post signature (appended to every post, overridden by customSignature if present)
  let signature = user?.postSignature?.trim();
  if (post.customSignature !== undefined && post.customSignature !== null) {
    signature = post.customSignature.trim();
  }
  if (signature) {
    parts.push("");
    parts.push(signature);
  }

  // Kruti.io watermark for trial and lifetime-free-domain users
  if (shouldShowWatermark({
    subscriptionStatus: user?.subscription?.status,
    email: user?.email,
    role: user?.role,
  })) {
    parts.push("");
    parts.push(WATERMARK_TEXT);
  }

  const fullText = parts.join("\n");

  // Build UGC post payload (text only initially)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ugcPost: Record<string, any> = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: fullText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  // Media precedence: user PDF > multi-image carousel (rendered as a PDF) > single image.
  const docUrl =
    post.documentUrl && post.documentUrl.startsWith("https://") ? post.documentUrl : null;
  const carousel = (post.carouselImages ?? []).filter((u) => !!u && u.startsWith("https://"));
  const singleImage =
    post.imageUrl && post.imageUrl.startsWith("https://") ? post.imageUrl : carousel[0] ?? null;

  // Attach a single image (the only image format the legacy UGC API reliably
  // renders). Used for single-image posts and as a carousel fallback.
  const attachSingleImage = async (url: string) => {
    const asset = await uploadImageToLinkedIn(accessToken, linkedinId, url);
    if (asset) {
      ugcPost.specificContent = {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: fullText },
          shareMediaCategory: "IMAGE",
          media: [{ status: "READY", media: asset }],
        },
      };
    }
  };

  if (docUrl) {
    // User-uploaded PDF document → versioned Documents + Posts APIs. The legacy
    // ugcPosts DOCUMENT recipe is not permitted for this app (the v2 assets
    // registerUpload returns 403 for feedshare-document), which used to silently
    // drop the PDF and fall back.
    try {
      const documentUrn = await uploadDocumentToLinkedIn(accessToken, linkedinId, docUrl);
      if (documentUrn) {
        const result = await createDocumentPost(
          accessToken,
          linkedinId,
          fullText,
          documentUrn,
          post.documentName || "Document"
        );
        if (result.success || result.requiresReauth) return result;
        // Non-auth post failure → fall through and publish the text-only post below.
      }
    } catch (docErr) {
      console.error("Document upload to LinkedIn failed, posting without document:", docErr);
    }
  } else if (carousel.length > 1) {
    // Multiple images → publish as a swipeable PDF carousel document via the
    // versioned Documents + Posts APIs (ugcPosts cannot reference document URNs).
    try {
      const pdfBytes = await imagesToPdf(carousel);
      const documentUrn = pdfBytes
        ? await uploadDocumentBufferToLinkedIn(accessToken, linkedinId, pdfBytes)
        : null;
      if (documentUrn) {
        const result = await createDocumentPost(
          accessToken,
          linkedinId,
          fullText,
          documentUrn,
          cleanInline(post.title) || "Carousel"
        );
        if (result.success || result.requiresReauth) return result;
      }
      // PDF build, upload, or post failed → at least post the first image.
      await attachSingleImage(carousel[0]);
    } catch (carErr) {
      console.error("Carousel document post failed, falling back to a single image:", carErr);
      try {
        await attachSingleImage(carousel[0]);
      } catch (fallbackErr) {
        console.error("Single-image fallback also failed:", fallbackErr);
      }
    }
  } else if (singleImage) {
    try {
      await attachSingleImage(singleImage);
    } catch (imgErr) {
      console.error("Image upload to LinkedIn failed, posting without image:", imgErr);
    }
  }

  // Post to LinkedIn UGC API
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(ugcPost),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LinkedIn UGC post error:", res.status, errText);

    // If 401, the token might have been revoked despite our refresh check
    if (res.status === 401) {
      return {
        success: false,
        error: "LinkedIn token was revoked. Please sign out and sign in again.",
        requiresReauth: true,
      };
    }

    // LinkedIn answers a duplicate with the urn of the share it already has:
    // "Content is a duplicate of urn:li:share:7528730858439127040". That is
    // the post, live on the member's feed - we just never recorded it,
    // usually because an earlier attempt was cut off after LinkedIn had
    // created the share but before we wrote it down. Handing the urn back
    // lets the caller reconcile instead of leaving the user to retry
    // something that can never succeed - and it was those retries that got
    // the account blocked with a 429 "UGC action was blocked".
    const duplicateOf =
      res.status === 422 ? errText.match(/urn:li:(?:share|ugcPost):\d+/)?.[0] : undefined;

    return {
      success: false,
      linkedinStatus: res.status,
      duplicateOf,
      error: linkedInErrorMessage(res.status, errText),
    };
  }

  const data = await res.json();
  return { success: true, linkedinPostId: data.id };
}

/**
 * Delete a member's own post from LinkedIn. Idempotent - a 204 (deleted) or 404
 * (already gone) both count as success, so it works whether Kruti removes a still-
 * live post or the user already deleted it manually on LinkedIn. Uses the legacy
 * ugcPosts DELETE (w_member_social), which accepts share and ugcPost URNs.
 */
export async function deleteLinkedInPost(
  userId: string,
  linkedinPostId: string
): Promise<LinkedInPostResult> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      error: "LinkedIn access token expired. Please sign out and sign in again to reconnect.",
      requiresReauth: true,
    };
  }

  const res = await fetch(
    `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(linkedinPostId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  // 204 = deleted (also returned for an already-deleted post); 404 = already gone.
  if (res.status === 204 || res.status === 404) {
    return { success: true };
  }
  if (res.status === 401) {
    return {
      success: false,
      error: "LinkedIn token was revoked. Please sign out and sign in again.",
      requiresReauth: true,
    };
  }
  const errText = await res.text();
  console.error("LinkedIn delete post error:", res.status, errText);
  return { success: false, error: "Couldn't remove the post from LinkedIn. Please try again." };
}

async function uploadImageToLinkedIn(
  accessToken: string,
  linkedinId: string,
  imageUrl: string
): Promise<string | null> {
  // Step 1: Register upload with LinkedIn
  const registerRes = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${linkedinId}`,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    }
  );

  if (!registerRes.ok) {
    console.error("LinkedIn image register failed:", await registerRes.text());
    return null;
  }

  const registerData = await registerRes.json();
  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
  const asset = registerData.value?.asset;

  if (!uploadUrl || !asset) {
    console.error("LinkedIn image register: missing uploadUrl or asset");
    return null;
  }

  // Step 2: Fetch image from Blob URL and upload binary to LinkedIn
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    console.error("Failed to fetch image from Blob URL:", imageUrl);
    return null;
  }

  const imageBuffer = await imageRes.arrayBuffer();
  const contentType = imageRes.headers.get("content-type") || "image/png";

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    console.error("LinkedIn image upload PUT failed:", await uploadRes.text());
    return null;
  }

  return asset; // e.g. "urn:li:digitalmediaAsset:C5422AQG..."
}

/**
 * Upload PDF bytes via the versioned Documents API and return the document URN
 * (urn:li:document:...). The legacy v2 assets feedshare-document recipe is NOT
 * permitted for this app (403), so documents must use the versioned API.
 */
async function uploadDocumentBufferToLinkedIn(
  accessToken: string,
  linkedinId: string,
  pdfBytes: ArrayBuffer | Uint8Array
): Promise<string | null> {
  // Step 1: Initialize a document upload (versioned REST API)
  const registerRes = await fetch(
    "https://api.linkedin.com/rest/documents?action=initializeUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify({
        initializeUploadRequest: { owner: `urn:li:person:${linkedinId}` },
      }),
    }
  );

  if (!registerRes.ok) {
    console.error("LinkedIn document initializeUpload failed:", await registerRes.text());
    return null;
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value?.uploadUrl;
  const documentUrn = registerData.value?.document;
  if (!uploadUrl || !documentUrn) {
    console.error("LinkedIn document initializeUpload: missing uploadUrl or document urn");
    return null;
  }

  // Step 2: Upload the PDF binary to LinkedIn
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/pdf",
    },
    body: pdfBytes as BodyInit,
  });

  if (!uploadRes.ok) {
    console.error("LinkedIn document upload PUT failed:", await uploadRes.text());
    return null;
  }

  return documentUrn; // e.g. "urn:li:document:D4D10AQ..."
}

/**
 * Publish a post with a document attachment (LinkedIn renders a multi-page PDF as a
 * swipeable carousel) via the versioned Posts API. The legacy ugcPosts API cannot
 * reference urn:li:document assets, so document posts must go through /rest/posts.
 */
async function createDocumentPost(
  accessToken: string,
  linkedinId: string,
  commentary: string,
  documentUrn: string,
  title: string
): Promise<LinkedInPostResult> {
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author: `urn:li:person:${linkedinId}`,
      commentary: escapeLittleText(commentary),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: { media: { title, id: documentUrn } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LinkedIn document post error:", res.status, errText);
    if (res.status === 401) {
      return {
        success: false,
        error: "LinkedIn token was revoked. Please sign out and sign in again.",
        requiresReauth: true,
      };
    }
    return { success: false, error: "Failed to post the document to LinkedIn." };
  }

  // 201 Created - the post URN arrives in the x-restli-id response header. If it is
  // somehow absent, report the id as undefined (never an empty string) so the post
  // is not later treated as having a valid, deletable URN.
  const postId = res.headers.get("x-restli-id");
  return { success: true, linkedinPostId: postId ?? undefined };
}

/** Fetch a PDF from a Blob URL and upload it as a LinkedIn document. */
async function uploadDocumentToLinkedIn(
  accessToken: string,
  linkedinId: string,
  documentUrl: string
): Promise<string | null> {
  const docRes = await fetch(documentUrl);
  if (!docRes.ok) {
    console.error("Failed to fetch PDF from Blob URL:", documentUrl);
    return null;
  }
  const docBuffer = await docRes.arrayBuffer();
  return uploadDocumentBufferToLinkedIn(accessToken, linkedinId, docBuffer);
}
