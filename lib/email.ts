import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface NewsletterContent {
  title: string;
  subject: string;
  intro: { hook: string; preview: string };
  sections: Array<{ heading: string; content: string; keyTakeaway: string }>;
  featuredInsight: { quote: string; context: string };
  cta: { heading: string; text: string; action: string };
  signoff: string;
}

function buildHtml(content: NewsletterContent, authorName: string): string {
  const sectionHtml = content.sections
    .map(
      (s) => `
      <div style="margin-bottom:28px;padding-left:16px;border-left:4px solid #0A66C2;">
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 10px 0;">${s.heading}</h2>
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 10px 0;white-space:pre-wrap;">${s.content}</p>
        <div style="background:#EFF6FF;border-radius:8px;padding:10px 14px;">
          <p style="font-size:13px;color:#0A66C2;font-weight:600;margin:0;">💡 Key Takeaway: ${s.keyTakeaway}</p>
        </div>
      </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${content.subject}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0A66C2;padding:32px 36px;text-align:center;">
      <p style="font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;">Newsletter</p>
      <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0;line-height:1.3;">${content.title}</h1>
    </div>

    <!-- Body -->
    <div style="padding:36px;">

      <!-- Intro -->
      <p style="font-size:16px;font-weight:700;color:#111827;line-height:1.6;margin:0 0 10px 0;">${content.intro.hook}</p>
      <p style="font-size:15px;color:#6B7280;line-height:1.7;margin:0 0 32px 0;">${content.intro.preview}</p>

      <!-- Sections -->
      ${sectionHtml}

      <!-- Featured Insight -->
      <div style="background:linear-gradient(135deg,#EFF6FF,#EEF2FF);border-radius:12px;padding:24px;margin:28px 0;">
        <p style="font-size:17px;font-weight:600;color:#1E293B;font-style:italic;margin:0 0 10px 0;">"${content.featuredInsight.quote}"</p>
        <p style="font-size:14px;color:#64748B;margin:0;">${content.featuredInsight.context}</p>
      </div>

      <!-- CTA -->
      <div style="background:#EFF6FF;border-radius:12px;padding:24px;margin:28px 0;">
        <h3 style="font-size:17px;font-weight:700;color:#0A66C2;margin:0 0 10px 0;">${content.cta.heading}</h3>
        <p style="font-size:15px;color:#374151;margin:0 0 10px 0;">${content.cta.text}</p>
        <p style="font-size:15px;font-weight:600;color:#0A66C2;margin:0;">${content.cta.action}</p>
      </div>

      <!-- Sign-off -->
      <p style="font-size:15px;color:#6B7280;font-style:italic;margin:24px 0 0 0;">${content.signoff}</p>
      <p style="font-size:15px;font-weight:600;color:#111827;margin:8px 0 0 0;">${escapeHtml(authorName)}</p>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:20px 36px;text-align:center;border-top:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Sent via Kruti.io · You're receiving this because you subscribed.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Trial Reminder Emails ──

function buildTrialReminderHtml({
  userName,
  daysRemaining,
  subscribeUrl,
}: {
  userName: string;
  daysRemaining: number;
  subscribeUrl: string;
}): string {
  const heading =
    daysRemaining === 0
      ? "Your free trial has ended"
      : daysRemaining === 1
        ? "Your trial ends tomorrow"
        : `Your trial ends in ${daysRemaining} days`;

  const message =
    daysRemaining === 0
      ? "Your 7-day free trial has ended. You can still view your existing posts and content, but you won't be able to generate new posts or schedule them until you subscribe."
      : daysRemaining === 1
        ? "This is your last full day on the free trial. After tomorrow, you won't be able to generate new AI posts or schedule them to LinkedIn. Subscribe now to keep your content flowing."
        : `You have ${daysRemaining} days left on your free trial. Don't lose access to AI-powered post generation, auto-scheduling, and LinkedIn publishing.`;

  const ctaText = daysRemaining === 0 ? "Subscribe to Continue" : "Subscribe Now";

  // Validate subscribeUrl is from our domain (prevent open redirect)
  const safeUrl = escapeHtml(subscribeUrl.replace(/[<>"']/g, ""));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0A66C2;padding:32px 36px;text-align:center;">
      <p style="font-size:12px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;">Kruti.io</p>
      <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0;line-height:1.3;">${heading}</h1>
    </div>

    <!-- Body -->
    <div style="padding:36px;">
      <p style="font-size:16px;color:#111827;line-height:1.6;margin:0 0 20px 0;">Hi ${escapeHtml(userName)},</p>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px 0;">${message}</p>

      <!-- What you get -->
      <div style="background:#EFF6FF;border-radius:12px;padding:20px;margin:0 0 24px 0;">
        <p style="font-size:14px;font-weight:700;color:#0A66C2;margin:0 0 12px 0;">With a subscription, you get:</p>
        <ul style="font-size:14px;color:#374151;line-height:1.8;margin:0;padding-left:20px;">
          <li>30 AI-generated LinkedIn posts per month</li>
          <li>Auto-scheduling &amp; LinkedIn auto-posting</li>
          <li>AI image generation for every post</li>
          <li>Personalized content strategy</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#0A66C2;color:#fff;font-size:16px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">${ctaText}</a>
      </div>

      <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0;">Starting at just ₹999/month</p>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:20px 36px;text-align:center;border-top:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Sent by Kruti.io · Your AI LinkedIn content assistant</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendTrialReminderEmail({
  to,
  userName,
  daysRemaining,
  subscribeUrl,
}: {
  to: string;
  userName: string;
  daysRemaining: number;
  subscribeUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_REPLACE_ME") {
    console.log(`[Email] Trial reminder (${daysRemaining}d) skipped - RESEND_API_KEY not configured`);
    return { success: true };
  }

  const from = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const subject =
    daysRemaining === 0
      ? "Your Kruti.io trial has ended"
      : daysRemaining === 1
        ? "Last full day of your Kruti.io trial"
        : `Your Kruti.io trial ends in ${daysRemaining} days`;

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      subject,
      html: buildTrialReminderHtml({ userName, daysRemaining, subscribeUrl }),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Email send failed" };
  }
}

// ── Profile Completeness Emails ──

function buildProfileUpdateHtml({
  userName,
  gaps,
  setupUrl,
}: {
  userName: string;
  gaps: Array<{ label: string; hint: string }>;
  setupUrl: string;
}): string {
  // Same treatment as the trial reminder: strip anything that could break out
  // of the href, then escape what is left.
  const safeUrl = escapeHtml(setupUrl.replace(/[<>"']/g, ""));
  const items = gaps
    .map(
      (g) => `
          <li style="margin-bottom:12px;">
            <span style="font-size:15px;font-weight:600;color:#111827;">${escapeHtml(g.label)}</span><br/>
            <span style="font-size:14px;color:#6B7280;line-height:1.6;">${escapeHtml(g.hint)}</span>
          </li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Finish your Kruti.io profile</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;">
    <div style="background:#0A66C2;padding:26px 36px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;">Kruti.io</p>
    </div>
    <div style="padding:32px 36px;">
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#111827;">We need one more thing from your profile</h1>
      <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">Hi ${escapeHtml(userName)},</p>
      <p style="margin:0 0 16px 0;font-size:15px;color:#374151;line-height:1.7;">
        Your posts are written from your profile, so we have added a few questions to your setup to keep them sounding like you rather than like anybody in your industry.
      </p>
      <p style="margin:0 0 20px 0;font-size:15px;color:#374151;line-height:1.7;">
        Your account is missing the answers below, so <strong style="color:#111827;">post writing, image generation and scheduling are paused</strong> until they are filled in.
      </p>
      <ul style="margin:0 0 26px 0;padding-left:20px;">${items}
      </ul>
      <a href="${safeUrl}" style="display:inline-block;background:#0A66C2;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">Finish my profile</a>
      <p style="margin:22px 0 0 0;font-size:14px;color:#6B7280;line-height:1.7;">
        It takes about two minutes, and everything switches back on the moment you save &mdash; whether you are on the free trial or a paid plan.
      </p>
    </div>
    <div style="background:#F9FAFB;padding:20px 36px;text-align:center;border-top:1px solid #E5E7EB;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Sent by Kruti.io &middot; Your AI LinkedIn content assistant</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendProfileUpdateEmail({
  to,
  userName,
  gaps,
  setupUrl,
}: {
  to: string;
  userName: string;
  gaps: Array<{ label: string; hint: string }>;
  setupUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_REPLACE_ME") {
    console.log("[Email] Profile update request skipped - RESEND_API_KEY not configured");
    return { success: true };
  }

  const from = process.env.FROM_EMAIL || "onboarding@resend.dev";

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      subject: "Action needed: finish your Kruti.io profile",
      html: buildProfileUpdateHtml({ userName, gaps, setupUrl }),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Email send failed" };
  }
}

// ── Newsletter Emails ──

export async function sendNewsletterEmail({
  to,
  authorName,
  content,
}: {
  to: string;
  authorName: string;
  content: NewsletterContent;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_REPLACE_ME") {
    console.log("[Email] RESEND_API_KEY not configured - skipping email send");
    return { success: true }; // Silently succeed so status still updates
  }

  const from = process.env.FROM_EMAIL || "onboarding@resend.dev";

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      subject: content.subject,
      html: buildHtml(content, authorName),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Email send failed" };
  }
}
