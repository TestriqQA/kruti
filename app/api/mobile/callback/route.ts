/**
 * Mobile OAuth Callback — FIXED v3.4
 *
 * v3.4 change (mandatory plan-selection):
 *   Removed the automatic 7-day trial creation block. Previously every
 *   first-time sign-in created a trialing Subscription row, which made
 *   the SubscriptionGate think the user had access — so it skipped the
 *   plan-selection screen. Now NO Subscription row is created here;
 *   the user must explicitly choose "Activate Trial" or "Subscribe"
 *   on the plan-selection screen, which then creates the row.
 *
 * v3.3 change (transit page redesign):
 *   The HTML "Returning to Kruti..." page is now Kruti-branded, light
 *   themed, and tries harder to open the app automatically so the user
 *   never needs to refresh:
 *     - Fires the krutimobile:// deep link immediately AND retries it a
 *       few times (Android sometimes ignores the very first attempt).
 *     - Big, clear "Open Kruti App" button as a manual fallback.
 *     - An explicit "Do not refresh this page" warning — refreshing
 *       re-uses the one-time OAuth code and causes
 *       token_exchange_failed:invalid_request.
 *   The token-exchange logic is UNCHANGED from v3.2 (it works).
 *
 * v3.2 fix: linkedinId UNIQUE-constraint safe (setLinkedInId).
 * v3.1 fix: token storage best-effort.
 * v3   fix: persists access_token + expires_at so publishing works.
 *
 * Path: app/api/mobile/callback/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { syncLinkedInProfile } from "@/lib/linkedin";

const APP_REDIRECT_URI = "krutimobile://oauth-callback";

/**
 * The redirect_uri is derived from the request host at call time rather than
 * read from MOBILE_OAUTH_REDIRECT_URI, so one deployment serves staging and
 * production without an extra env var to keep in step. The previous default
 * pointed at the mobile branch's Vercel preview, which would have made the
 * token exchange fail anywhere else.
 *
 * MOBILE_OAUTH_REDIRECT_URI still wins when set, as an escape hatch for a
 * host that is not the public URL LinkedIn has registered.
 */

function buildErrorRedirect(error: string) {
  return buildHtmlRedirect(
    `${APP_REDIRECT_URI}?error=${encodeURIComponent(error)}`,
  );
}

/**
 * Kruti-branded transit page. Auto-opens the app, retries the deep link,
 * and warns the user not to refresh (refresh re-uses the OAuth code).
 */
function buildHtmlRedirect(targetUrl: string) {
  const safeTarget = JSON.stringify(targetUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Returning to Kruti</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #EFF6FF;
      color: #0F172A;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 18px 48px rgba(37,99,235,0.16);
    }
    .logo {
      width: 88px;
      height: 88px;
      object-fit: contain;
      display: block;
      margin: 0 auto 22px;
    }
    .spinner {
      width: 34px;
      height: 34px;
      border: 3px solid #DBEAFE;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 18px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin-bottom: 8px;
    }
    p {
      font-size: 13.5px;
      color: #64748B;
      line-height: 1.5;
      margin-bottom: 22px;
    }
    .btn {
      display: block;
      background: #2563EB;
      color: #FFFFFF;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 15px 20px;
      border-radius: 14px;
      box-shadow: 0 10px 22px rgba(37,99,235,0.32);
    }
    .btn:active { opacity: 0.9; }
    .warn {
      margin-top: 18px;
      font-size: 12px;
      font-weight: 600;
      color: #B45309;
      background: #FEF3C7;
      border-radius: 10px;
      padding: 10px 12px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" alt="Kruti" src="data:image/png;base64,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" />
    <div class="spinner"></div>
    <h1>Returning to Kruti</h1>
    <p>Taking you back to the app. This only takes a moment.</p>
    <a class="btn" id="openBtn" href="${targetUrl}">Open Kruti App</a>
    <div class="warn">Please don't refresh this page — it will interrupt sign-in.</div>
  </div>
  <script>
    (function () {
      var target = ${safeTarget};
      function go() { window.location.href = target; }
      // Fire immediately, then retry — Android sometimes ignores the
      // first deep-link attempt right after the browser regains focus.
      go();
      setTimeout(go, 600);
      setTimeout(go, 1500);
      setTimeout(go, 3000);
      document.getElementById("openBtn").addEventListener("click", function (e) {
        e.preventDefault();
        go();
      });
    })();
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Prevent the browser from caching this one-time page.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Safely set user.linkedinId, handling the UNIQUE constraint.
 */
async function setLinkedInId(userId: string, linkedinId: string) {
  try {
    const owner = await prisma.user.findUnique({
      where: { linkedinId },
    });

    if (owner && owner.id !== userId) {
      await prisma.user.update({
        where: { id: owner.id },
        data: { linkedinId: null },
      });
      console.log(
        "[mobile/callback] linkedinId moved from",
        owner.id,
        "to",
        userId,
      );
    }

    if (!owner || owner.id !== userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { linkedinId },
      });
    }
  } catch (e) {
    console.error("[mobile/callback] setLinkedInId failed:", e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      console.warn("[mobile/callback] LinkedIn returned error:", oauthError);
      return buildErrorRedirect(oauthError);
    }
    if (!code) {
      return buildErrorRedirect("missing_code");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const authSecret = process.env.NEXTAUTH_SECRET;
    if (!clientId || !clientSecret || !authSecret) {
      console.error("[mobile/callback] Missing env vars:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasAuthSecret: !!authSecret,
      });
      const missing = [
        !clientId && "CLIENT_ID",
        !clientSecret && "CLIENT_SECRET",
        !authSecret && "NEXTAUTH_SECRET",
      ]
        .filter(Boolean)
        .join(",");
      return buildErrorRedirect(`server_misconfigured:${missing}`);
    }

    // Reconstruct the redirect_uri LinkedIn was originally given.
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host") || "";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("10.") ? "http" : "https");
    const redirectUri =
      process.env.MOBILE_OAUTH_REDIRECT_URI ||
      `${proto}://${host}/api/mobile/callback`;
    console.log("[mobile/callback] redirect_uri:", redirectUri);

    // -- Exchange code for access token --
    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[mobile/callback] Token exchange failed");
      console.error("[mobile/callback]   status:", tokenRes.status);
      console.error("[mobile/callback]   redirect_uri:", redirectUri);
      console.error("[mobile/callback]   LinkedIn says:", errText);

      let detail = `${tokenRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.error || parsed.error_description || detail;
      } catch {
        detail = errText.slice(0, 60) || detail;
      }
      return buildErrorRedirect(`token_exchange_failed:${detail}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    const expiresIn: number | undefined = tokenData.expires_in;
    const grantedScope: string = tokenData.scope ?? "";

    if (!accessToken) {
      console.error("[mobile/callback] No access_token in token response");
      return buildErrorRedirect("no_access_token");
    }

    console.log("[mobile/callback] granted scope:", grantedScope);
    if (!grantedScope.includes("w_member_social")) {
      console.warn(
        "[mobile/callback] WARNING: w_member_social NOT granted — " +
          "publishing to LinkedIn will fail.",
      );
    }

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      console.error("[mobile/callback] Profile fetch failed:", errText);
      return buildErrorRedirect("profile_fetch_failed");
    }

    const profile = await profileRes.json();

    if (!profile.email) {
      return buildErrorRedirect("email_missing");
    }

    const linkedinMemberId: string | undefined = profile.sub;

    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    const userData = {
      email: profile.email,
      name:
        `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() ||
        profile.email,
      image: profile.picture ?? null,
    };

    if (!user) {
      user = await prisma.user.create({ data: userData });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: userData.name, image: userData.image },
      });
    }

    if (linkedinMemberId) {
      await setLinkedInId(user.id, linkedinMemberId);
    } else {
      console.warn(
        "[mobile/callback] profile.sub missing — publishing may fail",
      );
    }

    try {
      const expiresAt = expiresIn
        ? Math.floor(Date.now() / 1000) + expiresIn
        : null;

      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: "linkedin" },
      });

      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            ...(linkedinMemberId
              ? { providerAccountId: linkedinMemberId }
              : {}),
            access_token: accessToken,
            expires_at: expiresAt,
          },
        });
        console.log("[mobile/callback] Account token updated for", user.id);
      } else {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "linkedin",
            providerAccountId: linkedinMemberId ?? user.id,
            access_token: accessToken,
            expires_at: expiresAt,
          },
        });
        console.log("[mobile/callback] Account token created for", user.id);
      }
    } catch (e) {
      console.error("[mobile/callback] LinkedIn token store failed:", e);
    }

    try {
      await syncLinkedInProfile(user.id, accessToken);
    } catch (err) {
      console.error("[mobile/callback] syncLinkedInProfile failed:", err);
    }

    // -- NO automatic trial creation --
    // The user must explicitly choose "Activate Trial" or "Subscribe"
    // on the plan-selection screen. The subscription row is created
    // there (by /activate-trial or /create-order), not here.

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscription: true },
    });

    const token = await encode({
      token: {
        uid: user.id,
        role: (fullUser as any)?.role ?? "user",
        onboardingCompleted: (fullUser as any)?.onboardingCompleted ?? false,
        subscriptionStatus: fullUser?.subscription?.status ?? "none",
        trialEnd: fullUser?.subscription?.trialEnd?.toISOString() ?? null,
        email: profile.email,
        name: userData.name,
        picture: profile.picture,
      },
      secret: authSecret,
      // App session token validity. 24h was too short — users got
      // "Unauthorized" the next day (token expired). 30 days is a sensible
      // mobile session; the app re-auths via LinkedIn when it finally expires.
      maxAge: 30 * 24 * 60 * 60,
    });

    console.log("[mobile/callback] Success — scope:", grantedScope);
    return buildHtmlRedirect(
      `${APP_REDIRECT_URI}?token=${encodeURIComponent(token)}`,
    );
  } catch (err: any) {
    console.error("[mobile/callback] Unexpected error:", err);
    return buildErrorRedirect("unexpected_error");
  }
}