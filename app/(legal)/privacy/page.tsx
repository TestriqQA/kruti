import { COMPANY } from "@/lib/company";
import { Metadata } from "next";
import LegalContact from "@/components/LegalContact";
import Link from "next/link";
import LegalSection from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Privacy Policy | Kruti.io",
  description:
    "Learn how Kruti.io by Cinute InfoMedia collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <article>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: March 10, 2026 &middot; Effective Date: March 10, 2026
        </p>
      </div>

      <LegalSection id="introduction" title="1. Introduction">
        <p>
          Welcome to <strong>Kruti.io</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), an AI-powered
          LinkedIn content generation platform operated by <strong>Cinute InfoMedia</strong>,
          a sole proprietorship registered in Maharashtra, India (GSTIN 27AMZPM6333R1ZU).
          Cinute InfoMedia is the Data Fiduciary for the purposes of India&rsquo;s Digital
          Personal Data Protection Act, 2023.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, store, share, and protect your personal
          information when you use our platform at{" "}
          <strong>kruti.io</strong> (the &ldquo;Service&rdquo;). By accessing or using Kruti.io, you
          acknowledge that you have read and understood this Privacy Policy.
        </p>
        <p>
          We are committed to protecting your privacy and handling your data transparently. This
          policy applies to all users of the Service, including those on free trials and paid
          subscriptions.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="2. Information We Collect">
        <p>We collect the following categories of information:</p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          a) Account Information via LinkedIn OAuth
        </h3>
        <p>
          When you sign in using LinkedIn, we receive and store the following through LinkedIn&rsquo;s
          OAuth 2.0 / OpenID Connect protocol (scopes: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">openid</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">profile</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">email</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">w_member_social</code>):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Full name</li>
          <li>Email address</li>
          <li>Profile picture URL</li>
          <li>LinkedIn profile identifier (an opaque member ID, not your public profile URL)</li>
        </ul>
        <p className="mt-2 text-sm">
          We do <strong>not</strong> receive your About section, work experience, activity,
          connections or any other profile content from LinkedIn. Your professional headline is
          not taken from LinkedIn either &mdash; you enter it yourself during onboarding, and you
          can change it at any time in Settings.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          b) Profile Data You Provide
        </h3>
        <p>
          During onboarding and in your Settings, you may provide additional information to
          personalize your content generation experience:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Professional summary and industry</li>
          <li>Skills and expertise topics</li>
          <li>Content positioning and tone preferences</li>
          <li>Content goals and styles</li>
          <li>Target audience description</li>
          <li>Posting schedule preferences</li>
          <li>Post signature / sign-off text</li>
          <li>Human Mode preference (writing style setting)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          c) Content Data
        </h3>
        <p>We store the content you create and generate using our platform:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>AI-generated content plans (weekly strategies, pillars, themes)</li>
          <li>Posts (titles, body text, hashtags, AI image prompts, generated images)</li>
          <li>Newsletter drafts (titles, subjects, bodies)</li>
          <li>Content repurposing outputs (Twitter threads, blog posts, emails)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          d) Payment Information
        </h3>
        <p>
          Subscription payments are processed by <strong>Razorpay</strong>. We store only:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Razorpay customer identifier</li>
          <li>Razorpay subscription identifier</li>
          <li>Selected plan and currency preference (INR or USD)</li>
          <li>Subscription status and billing period dates</li>
        </ul>
        <p className="font-medium text-gray-700 dark:text-gray-300 mt-2">
          We do NOT store your credit card numbers, bank account details, UPI IDs, or any payment
          instrument information. All sensitive payment data is handled exclusively by Razorpay.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          e) Technical Data
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Session tokens (JWT-based authentication)</li>
          <li>Server access logs (IP addresses, timestamps, user agent strings)</li>
          <li>Error logs for debugging and service improvement</li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use-information" title="3. How We Use Your Information">
        <p>We use your information for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>AI Content Generation:</strong> Your profile data, preferences, and content
            history are used to generate personalized LinkedIn posts, content strategies, images,
            and newsletters via Google&rsquo;s Generative AI services.
          </li>
          <li>
            <strong>Personalization:</strong> To tailor content recommendations, tone, and strategy
            to your professional profile and goals.
          </li>
          <li>
            <strong>LinkedIn Posting:</strong> To post content to your LinkedIn profile on your
            behalf using the <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">w_member_social</code> scope authorization.
          </li>
          <li>
            <strong>Payment Processing:</strong> To manage your subscription, process payments via
            Razorpay, and handle billing-related communications.
          </li>
          <li>
            <strong>Transactional Emails:</strong> To send account-related notifications and
            newsletter deliveries.
          </li>
          <li>
            <strong>Service Improvement:</strong> To monitor platform performance, fix issues,
            and improve features.
          </li>
          <li>
            <strong>Legal Compliance:</strong> To comply with applicable laws and respond to legal
            requests.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-data-processing" title="4. AI Data Processing">
        <p>
          Kruti.io uses Google&rsquo;s Gemini API. Post, strategy and newsletter text is generated
          with <strong>Gemini 2.5 Flash</strong>; <strong>Gemini 2.5 Pro</strong> is used for carousel planning and image briefs. Images are generated with <strong>Gemini 3.1 Flash Image</strong>.
          When generating content, we send the following to Google&rsquo;s AI APIs:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your full name</li>
          <li>Your professional headline, industry and skills</li>
          <li>Your About / summary text, as you entered it during onboarding</li>
          <li>Your tone preferences, content goals and positioning</li>
          <li>Your target audience description</li>
          <li>
            Content context for continuity &mdash; previous post titles, and prior weeks&rsquo;
            themes and focuses when building a content plan
          </li>
          <li>Image generation prompts, which include your headline, industry and post text</li>
        </ul>
        <p className="mt-2 text-sm">
          We do <strong>not</strong> send Google your email address, your LinkedIn identifier, your
          LinkedIn profile URL, your post signature or your timezone. No file you upload &mdash; no
          image, document or screenshot &mdash; is ever sent to Google; every request we make is
          text only.
        </p>
        <p className="mt-2 text-sm">
          When building a content plan we additionally enable Google Search grounding, which means
          Gemini issues live Google searches derived from your industry, target audience and
          content themes so posts can reflect current context. If that step fails, your posts are
          generated without it.
        </p>
        <p>
          This data is transmitted securely to Google&rsquo;s servers for processing. Google&rsquo;s{" "}
          <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Generative AI Terms of Service
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Privacy Policy
          </a>{" "}
          govern how Google handles this data.
        </p>
        <p>
          <strong>Kruti.io does not use your data to train AI models.</strong> We use Google&rsquo;s
          API services solely for generating content on your behalf.
        </p>
      </LegalSection>

      <LegalSection id="third-party-services" title="5. Third-Party Services">
        <p>
          We integrate with the following third-party services, each governed by their own privacy
          policies:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>LinkedIn Corporation:</strong> Authentication (OAuth 2.0) and content posting.
            Subject to{" "}
            <a href="https://www.linkedin.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              LinkedIn&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Google LLC (Gemini API):</strong> AI content and image generation, and Google
            Search grounding when building a content plan. Subject to{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Google&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Razorpay:</strong> Payment processing for subscriptions. Subject to{" "}
            <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Razorpay&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Resend:</strong> Transactional email delivery. Receives your email address and
            the contents of the message we send you.
          </li>
          <li>
            <strong>Vercel Inc.:</strong> Hosting and file storage. Every generated image, uploaded
            document and support screenshot is stored with Vercel, and our application and server
            logs run on their platform.
          </li>
          <li>
            <strong>Supabase:</strong> Managed PostgreSQL hosting for our database, which holds
            your account, profile, content and subscription records.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Google, Resend and Vercel process data on servers outside India. Razorpay processes
          payments in India. Where we transfer your data abroad we do so to provide the Service you
          have asked for.
        </p>
      </LegalSection>

      <LegalSection id="cookies-and-tracking" title="6. Cookies and Tracking">
        <p>
          We use essential cookies for authentication and session management. We do not use
          third-party advertising or analytics cookies.
        </p>
        <p>
          For a detailed breakdown of cookies and similar technologies we use, please refer to
          our{" "}
          <Link href="/cookies" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Cookie Policy
          </Link>.
        </p>
      </LegalSection>

      <LegalSection id="data-storage-and-security" title="7. Data Storage and Security">
        <p>We implement appropriate technical and organizational measures to protect your data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All data is transmitted over HTTPS (TLS encryption in transit)</li>
          <li>Authentication managed via a signed JWT (JSON Web Token) session strategy</li>
          <li>
            Database access is restricted to the application, and every query is scoped to the
            signed-in account
          </li>
          <li>Payment data handled exclusively by PCI-DSS compliant Razorpay</li>
          <li>
            LinkedIn OAuth tokens are used only for actions you have authorised &mdash; publishing
            a post you marked ready, uploading its image, and reading your profile at sign-in
          </li>
        </ul>
        <p className="mt-3 text-sm">
          <strong>Two limitations we would rather state than imply.</strong> Your LinkedIn access
          and refresh tokens are stored in our database without an additional layer of
          application-level encryption, protected by the database&rsquo;s own access controls and
          encryption at rest. And files we store for you &mdash; generated images, uploaded
          documents and support screenshots &mdash; are held at unlisted public URLs: they are not
          indexed or linked anywhere, but anyone who obtains the exact URL can open the file
          without signing in. Do not attach anything to a support ticket that you would not want
          read by someone holding that link.
        </p>
        <p>
          <strong>We do not sell, rent, or trade your personal data to third parties</strong> for
          marketing or any other purpose.
        </p>
      </LegalSection>

      <LegalSection id="data-retention" title="8. Data Retention">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Account data</strong> is retained for as long as your account is active.
          </li>
          <li>
            <strong>Content data</strong> (posts, plans, newsletters) is retained for as long as
            your account is active, with one exception: <strong>generated images are deleted
            seven days after the post they belong to is published</strong>, and unused generated
            images are swept on the same schedule. Download anything you want to keep.
          </li>
          <li>
            <strong>Support tickets:</strong> replies from our team are deleted three days after
            they are sent, whether or not you have read them.
          </li>
          <li>
            <strong>Upon account deletion:</strong> your account, profile, content plans, posts,
            newsletters, subscription record and support history are deleted from our database,
            and the deletion cascades through all related records &mdash; including the LinkedIn
            tokens held against your account. We also delete the files themselves: generated
            images, carousel frames, uploaded documents and support screenshots are removed from
            our file storage as part of the same operation.
          </li>
          <li>
            <strong>Payment records:</strong> Razorpay may retain transaction records in accordance
            with their data retention policies and applicable financial regulations.
          </li>
          <li>
            <strong>Server logs:</strong> our hosting provider retains runtime logs according to
            its own retention schedule. These logs can contain your account identifier and, where
            we send you email, your email address.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          <strong>You can delete your account yourself.</strong> Go to{" "}
          <strong>Settings</strong>, scroll to &ldquo;Delete your account&rdquo;, and confirm. It
          takes effect immediately and we cannot reverse it, so export anything you want to keep
          first. You do not need an active subscription to do this. If you would rather we handled
          it, email{" "}
          <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            support@kruti.io
          </a>.
        </p>
        <p className="mt-2 text-sm">
          Posts already published to LinkedIn remain on LinkedIn &mdash; they live on your profile,
          not on ours. Delete those from LinkedIn itself.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="9. Your Rights">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-2">
          Under Indian Law (IT Act, 2000 & SPDI Rules, 2011)
        </h3>
        <p>As a user based in India, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate personal data</li>
          <li>Withdraw consent for processing your sensitive personal data</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          Under GDPR (for users in the European Union)
        </h3>
        <p>If you are located in the EU/EEA, you additionally have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Data portability - receive your data in a structured, machine-readable format. Today
            you can export your posts as a CSV from the dashboard; for anything beyond that
            (profile, content plans, newsletters, support history) email us and we will compile it
          </li>
          <li>Erasure (&ldquo;right to be forgotten&rdquo;) - request deletion of your data</li>
          <li>Restriction of processing</li>
          <li>Object to processing based on legitimate interests</li>
          <li>Lodge a complaint with a supervisory authority</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          How to Exercise Your Rights
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Delete your account:</strong> Contact us at{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>{" "}
            to request complete account and data deletion.
          </li>
          <li>
            <strong>Export your data:</strong> Request a copy of your data by emailing{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>.
          </li>
          <li>
            <strong>Revoke LinkedIn access:</strong> You can disconnect Kruti.io from your
            LinkedIn account at any time via LinkedIn&rsquo;s Settings &gt; Data Privacy &gt; Permitted
            Services.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="childrens-privacy" title="10. Children&rsquo;s Privacy">
        <p>
          Kruti.io is not intended for individuals under the age of 18, and our Terms require you
          to be 18 or older to hold an account. We should be straightforward about how that is
          enforced: we do not ask your date of birth and LinkedIn does not tell us your age, so we
          have no technical age check &mdash; we rely on LinkedIn&rsquo;s own minimum age for an
          account and on the undertaking in our Terms. We do not knowingly collect personal
          information from minors. If you believe a minor has provided us with personal data,
          please contact us at{" "}
          <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>,
          and we will promptly delete such information.
        </p>
      </LegalSection>

      <LegalSection id="international-transfers" title="11. International Data Transfers">
        <p>
          Your data may be processed in jurisdictions outside your country of residence:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Google (United States):</strong> AI content generation via Google Gemini and
            Gemini APIs
          </li>
          <li>
            <strong>Razorpay (India):</strong> Payment processing
          </li>
          <li>
            <strong>Infrastructure providers:</strong> Hosting and CDN services
          </li>
        </ul>
        <p>
          Where data is transferred internationally, we ensure appropriate safeguards are in
          place, including compliance with applicable data protection regulations.
        </p>
      </LegalSection>

      <LegalSection id="changes-to-policy" title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Update the &ldquo;Last Updated&rdquo; date at the top of this page</li>
          <li>Notify you via email or an in-app notification for significant changes</li>
        </ul>
        <p>
          Your continued use of Kruti.io after changes are posted constitutes your acceptance of
          the updated Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>
          If you have any questions, concerns, or requests regarding this Privacy Policy or your
          personal data, please contact us:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mt-2 space-y-1.5">
          <LegalContact />
          <p>Website: kruti.io</p>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Grievance Officer</p>
          <p className="mt-1">
            In accordance with the Information Technology Act, 2000 and Section 13 of the Digital
            Personal Data Protection Act, 2023:
          </p>
          <p className="mt-2">
            <strong>{COMPANY.proprietor}</strong>
            <br />
            Proprietor and Data Fiduciary, {COMPANY.name}
            <br />
            {COMPANY.address.line1}, {COMPANY.address.line2},
            <br />
            {COMPANY.address.locality}, {COMPANY.address.district}, {COMPANY.address.region}{" "}
            {COMPANY.address.postalCode}, {COMPANY.address.country}
            <br />
            Email:{" "}
            <a
              href={`mailto:${COMPANY.supportEmail}`}
              className="text-[#0A66C2] dark:text-blue-400 hover:underline"
            >
              {COMPANY.supportEmail}
            </a>
          </p>
          <p className="mt-2 text-sm">
            Mark your message &ldquo;Grievance&rdquo; so we can route it. We aim to acknowledge
            within 3 working days and to resolve within 30 days. Because Cinute InfoMedia is a
            sole proprietorship, the proprietor is personally the Data Fiduciary and handles
            these directly.
          </p>
        </div>

        <p className="mt-4">
          <strong>Escalating beyond us.</strong> If you are not satisfied with how we have handled
          your grievance, you may complain to the{" "}
          <strong>Data Protection Board of India</strong>, established under the Digital Personal
          Data Protection Act, 2023. You are not required to come to us first, but it is usually
          faster.
        </p>
      </LegalSection>

      <LegalSection id="nomination" title="13. Nominating Someone to Act for You">
        <p>
          Section 14 of the Digital Personal Data Protection Act, 2023 gives you the right to
          nominate another individual to exercise your rights under the Act on your behalf in the
          event of your death or incapacity.
        </p>
        <p>
          We do not yet offer a form for this in the product. To make a nomination, email us at{" "}
          <a
            href={`mailto:${COMPANY.supportEmail}`}
            className="text-[#0A66C2] dark:text-blue-400 hover:underline"
          >
            {COMPANY.supportEmail}
          </a>{" "}
          with the subject &ldquo;Nomination&rdquo;, naming the person and giving their contact
          details. We will record it against your account and confirm it to you in writing. You can
          change or withdraw a nomination at any time the same way.
        </p>
      </LegalSection>
    </article>
  );
}
