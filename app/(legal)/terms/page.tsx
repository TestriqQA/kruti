import { Metadata } from "next";
import LegalContact from "@/components/LegalContact";
import Link from "next/link";
import LegalSection from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Terms of Use | Kruti.io",
  description:
    "Terms of Use for Kruti.io, the AI-powered LinkedIn content platform by Cinute InfoMedia",
};

export default function TermsOfUsePage() {
  return (
    <article>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: March 10, 2026 &middot; Effective Date: March 10, 2026
        </p>
      </div>

      <LegalSection id="acceptance" title="1. Acceptance of Terms">
        <p>
          By accessing or using <strong>Kruti.io</strong> at kruti.io (the &ldquo;Service&rdquo;),
          operated by <strong>Cinute InfoMedia</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;), you agree to be bound by these Terms of Use (&ldquo;Terms&rdquo;).
        </p>
        <p>
          If you do not agree with any part of these Terms, you must not use the Service. You
          represent that you are at least 18 years of age and have the legal capacity to enter
          into a binding agreement.
        </p>
        <p>
          These Terms, together with our{" "}
          <Link href="/privacy" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Privacy Policy</Link>,{" "}
          <Link href="/refund" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Refund Policy</Link>,{" "}
          <Link href="/cookies" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Cookie Policy</Link>, and{" "}
          <Link href="/disclaimer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Disclaimer</Link>,
          constitute the entire agreement between you and Cinute InfoMedia regarding the Service.
        </p>
      </LegalSection>

      <LegalSection id="service-description" title="2. Description of Service">
        <p>
          Kruti.io is an AI-powered platform that helps professionals create, manage, and publish
          LinkedIn content. The Service includes:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>AI-generated content strategies and weekly content plans</li>
          <li>Post generation using Google Gemini (Gemini 2.5 Flash and 2.5 Pro for text, Gemini 3.1 Flash Image for images)</li>
          <li>Content calendar with scheduling capabilities</li>
          <li>Auto-posting to LinkedIn on your behalf</li>
          <li>Content repurposing for multiple platforms</li>
          <li>Newsletter drafting and delivery</li>
          <li>Analytics and performance tracking</li>
          <li>Post variant generation and A/B content options</li>
        </ul>
        <p>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Features may
          be added, modified, or discontinued at our discretion with reasonable notice.
        </p>
      </LegalSection>

      <LegalSection id="account-creation" title="3. Account Creation and Authentication">
        <p>
          To use Kruti.io, you must authenticate via <strong>LinkedIn OAuth</strong>. By signing
          in, you authorize us to access your LinkedIn profile information as described in our{" "}
          <Link href="/privacy" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Privacy Policy</Link>.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>One Kruti.io account per LinkedIn profile is permitted.</li>
          <li>You are responsible for maintaining the security of your LinkedIn account.</li>
          <li>You must provide accurate and complete information during onboarding.</li>
          <li>
            A <strong>7-day free trial</strong> is automatically created upon your first sign-in,
            granting full access to Content Pro features.
          </li>
          <li>
            You must not create accounts for the purpose of abusing the free trial or any
            promotional offers.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="subscription-billing" title="4. Subscription and Billing">
        <p>After your free trial, continued access requires a paid subscription:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Content Pro:</strong> &#8377;999/month (INR) or $19/month (USD)
          </li>
          <li>
            Billing is handled by <strong>Razorpay</strong> and recurs monthly on the anniversary
            of your subscription start date.
          </li>
          <li>
            Your subscription <strong>auto-renews</strong> each month unless canceled before the
            renewal date.
          </li>
          <li>
            You may select your preferred currency (INR or USD) at checkout. Currency cannot be
            changed after subscription activation without canceling and resubscribing.
          </li>
          <li>
            If a payment fails, your account status will change to &ldquo;past due.&rdquo; After
            repeated failures, access to the dashboard may be restricted until payment is
            resolved.
          </li>
          <li>
            All prices are exclusive of applicable taxes, which will be charged as required by
            law.
          </li>
        </ul>
        <p>
          For cancellation and refund details, please refer to our{" "}
          <Link href="/refund" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Refund Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection id="ai-generated-content" title="5. AI-Generated Content">
        <p>
          Kruti.io generates text and images using Google&rsquo;s AI models. By using the Service,
          you acknowledge and agree:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>No ownership claim by us:</strong> We do not claim ownership of AI-generated
            content produced for you. You may use, modify, and publish the generated content as
            you see fit.
          </li>
          <li>
            <strong>Your responsibility:</strong> You are solely responsible for reviewing,
            editing, and approving all generated content before publishing it to LinkedIn or any
            other platform.
          </li>
          <li>
            <strong>No accuracy guarantee:</strong> AI-generated content may contain errors,
            inaccuracies, outdated information, or biases. We do not warrant the accuracy,
            completeness, or suitability of any generated content.
          </li>
          <li>
            <strong>Google&rsquo;s terms apply:</strong> Content generated using Google Gemini and
            Gemini is also subject to Google&rsquo;s Generative AI Terms of Service.
          </li>
          <li>
            <strong>License to process:</strong> You grant Kruti.io a non-exclusive,
            non-transferable license to use your profile data and inputs for the purpose of
            generating content on your behalf.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="linkedin-integration" title="6. LinkedIn Integration">
        <p>Kruti.io integrates with LinkedIn for authentication and content posting:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            We access your LinkedIn profile via OAuth 2.0 with the scopes:{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">openid</code>,{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">profile</code>,{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">email</code>, and{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">w_member_social</code>.
          </li>
          <li>
            The auto-posting feature publishes content to your LinkedIn feed on your behalf. You
            must ensure all published content complies with LinkedIn&rsquo;s Professional Community
            Policies and User Agreement.
          </li>
          <li>
            <strong>You remain fully responsible</strong> for all content posted to your LinkedIn
            account via Kruti.io.
          </li>
          <li>
            Kruti.io is an independent product and is <strong>not affiliated with, endorsed by,
            or sponsored by LinkedIn Corporation</strong>.
          </li>
          <li>
            LinkedIn may modify or revoke API access at any time, which could affect Service
            features. We are not liable for such changes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="acceptable-use" title="7. Acceptable Use Policy">
        <p>You agree not to use Kruti.io to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Generate or publish illegal, defamatory, harassing, threatening, or hateful content</li>
          <li>Create misleading, fraudulent, or deceptive content</li>
          <li>Impersonate other individuals or organizations</li>
          <li>Spam or mass-post repetitive content</li>
          <li>Attempt to circumvent subscription or trial limitations</li>
          <li>Reverse-engineer, decompile, or scrape the Service</li>
          <li>Use automated scripts or bots to interact with the platform beyond provided features</li>
          <li>Violate any applicable laws or LinkedIn&rsquo;s terms of service</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate this Acceptable Use
          Policy without prior notice or refund.
        </p>
      </LegalSection>

      <LegalSection id="intellectual-property" title="8. Intellectual Property">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            The Kruti.io platform, including its design, codebase, UI, branding, and
            documentation, is the property of <strong>Cinute InfoMedia</strong> and is
            protected by applicable intellectual property laws.
          </li>
          <li>
            <strong>Google Gemini</strong> is a trademark of
            Google LLC.
          </li>
          <li>
            <strong>LinkedIn</strong> is a trademark of LinkedIn Corporation, a subsidiary of
            Microsoft Corporation.
          </li>
          <li>
            <strong>Razorpay</strong> is a trademark of Razorpay Software Pvt. Ltd.
          </li>
          <li>
            You retain all rights to your original profile data, inputs, and any modifications
            you make to AI-generated content.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="limitation-of-liability" title="9. Limitation of Liability">
        <p>To the maximum extent permitted by applicable law:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Kruti.io and Cinute InfoMedia shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the
            Service.
          </li>
          <li>
            We are not liable for any actions taken by LinkedIn regarding your account, including
            restrictions, shadowbanning, or content removal.
          </li>
          <li>
            We are not liable for the accuracy, quality, or performance of AI-generated content.
          </li>
          <li>
            Our total aggregate liability for any claims related to the Service shall not exceed
            the total subscription fees you have paid in the <strong>three (3) months</strong>{" "}
            preceding the event giving rise to the claim.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" title="10. Termination">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>By you:</strong> You may cancel your subscription at any time from the
            Settings page or by contacting{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>.
            Cancellation takes effect at the end of the current billing period.
          </li>
          <li>
            <strong>By us:</strong> We may suspend or terminate your account if you violate
            these Terms, engage in fraudulent activity, or abuse the Service. In cases of severe
            violations, termination may be immediate without notice.
          </li>
          <li>
            <strong>Effect of termination:</strong> Upon termination, your access to the Service
            is revoked. Your data may be deleted after a reasonable retention period, as described
            in our{" "}
            <Link href="/privacy" className="text-[#0A66C2] dark:text-blue-400 hover:underline">Privacy Policy</Link>.
          </li>
          <li>
            <strong>Surviving clauses:</strong> Sections on Intellectual Property, Limitation of
            Liability, Governing Law, and Indemnification survive termination.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="governing-law" title="11. Governing Law and Dispute Resolution">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            These Terms are governed by and construed in accordance with the <strong>laws of
            India</strong>.
          </li>
          <li>
            Any dispute arising from or related to these Terms shall first be attempted to be
            resolved through good-faith negotiation between the parties.
          </li>
          <li>
            If negotiation fails, the dispute shall be referred to <strong>arbitration</strong>{" "}
            under the Arbitration and Conciliation Act, 1996, with the seat of arbitration in
            India. The proceedings shall be conducted in English.
          </li>
          <li>
            Subject to the arbitration clause, the courts of India shall have exclusive
            jurisdiction.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="modifications" title="12. Modifications to Terms">
        <p>
          We reserve the right to modify these Terms at any time. When we make material changes:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>We will update the &ldquo;Last Updated&rdquo; date at the top of this page.</li>
          <li>We will notify you via email or in-app notification for significant changes.</li>
          <li>
            Continued use of the Service after changes are posted constitutes acceptance of the
            revised Terms.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>
          For questions about these Terms of Use, please contact us:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mt-2 space-y-1.5">
          <LegalContact />
          <p>Website: kruti.io</p>
        </div>
      </LegalSection>
    </article>
  );
}
