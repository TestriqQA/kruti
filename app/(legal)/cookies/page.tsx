import { Metadata } from "next";
import LegalContact from "@/components/LegalContact";
import LegalSection from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Cookie Policy | Kruti.io",
  description:
    "Learn about the cookies and similar technologies used by Kruti.io.",
};

export default function CookiePolicyPage() {
  return (
    <article>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Cookie Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: March 10, 2026 &middot; Effective Date: March 10, 2026
        </p>
      </div>

      <LegalSection id="what-are-cookies" title="1. What Are Cookies">
        <p>
          Cookies are small text files that are placed on your device (computer, smartphone,
          or tablet) when you visit a website. They are widely used to make websites work
          efficiently, provide information to site owners, and enhance user experience.
        </p>
        <p>
          This Cookie Policy explains how <strong>Kruti.io</strong>, operated by{" "}
          <strong>Cinute InfoMedia</strong>, uses cookies and similar technologies on
          kruti.io.
        </p>
      </LegalSection>

      <LegalSection id="cookies-we-use" title="2. Cookies We Use">
        <p>
          Kruti.io uses only <strong>essential cookies</strong> required for the platform to
          function. We do not use advertising, analytics, or social media tracking cookies.
        </p>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Cookie</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Purpose</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <tr>
                <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">__Secure-next-auth.session-token</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Maintains your authenticated session using a signed JWT</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Essential</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">24 hours</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">__Host-next-auth.csrf-token</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Protects against cross-site request forgery (CSRF) attacks</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Essential</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Session</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">__Secure-next-auth.callback-url</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Stores the redirect URL during the LinkedIn OAuth sign-in flow</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Essential</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Session</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">__Secure-next-auth.state</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Guards the LinkedIn OAuth exchange against interception; set on each sign-in attempt</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Essential</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">15 minutes</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">site-gate</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Remembers that you passed the access gate, where one is enabled on a pre-release build</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Essential</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Session</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="third-party-cookies" title="3. Third-Party Cookies">
        <p>
          Certain third-party services integrated with Kruti.io may set their own cookies when
          you interact with their features:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Razorpay (Payment Processing):</strong> Razorpay&rsquo;s checkout script loads
            on dashboard pages where a subscription action is available &mdash; not only once you
            open the payment modal &mdash; and may set cookies for session management, fraud
            detection and payment processing from that point. Loading the script also discloses
            your IP address and browser to Razorpay. These cookies are governed by{" "}
            <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Razorpay&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>LinkedIn (OAuth Authentication):</strong> During the LinkedIn sign-in flow,
            LinkedIn may set cookies on their domain for authentication and security purposes.
            These are governed by{" "}
            <a href="https://www.linkedin.com/legal/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              LinkedIn&rsquo;s Cookie Policy
            </a>.
          </li>
        </ul>
        <p>
          <strong>Note:</strong> Google AI API calls (Gemini) are made server-side and
          do not result in any client-side cookies being set by Google.
        </p>
      </LegalSection>

      <LegalSection id="local-storage" title="4. Local Storage and Similar Technologies">
        <p>
          In addition to cookies, Kruti.io may use browser local storage for the following:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Theme preference</strong> (<code className="text-xs">theme</code>): your dark
            or light mode selection, so it persists between visits.
          </li>
          <li>
            <strong>Onboarding draft</strong>: while you are completing onboarding, your answers
            are saved in local storage so you do not lose them if you close the tab. This includes
            the professional details you type &mdash; your headline, industry, summary, skills,
            tone and target audience &mdash; and it is cleared once onboarding is submitted.
          </li>
          <li>
            <strong>Trial notice dismissal</strong>: a record that you dismissed the
            trial-ending notice, so it is not shown again the same day.
          </li>
        </ul>
        <p>
          These items are written by your browser and are not themselves transmitted to us.
          Be aware, though, that the onboarding answers held in the draft above are the same
          answers you then submit to us when you finish onboarding, and which we send to
          Google&rsquo;s Gemini API to generate your content. The local copy is a convenience,
          not a guarantee that the information stays on your device.
        </p>
      </LegalSection>

      <LegalSection id="managing-cookies" title="5. How to Manage Cookies">
        <p>
          You can control and manage cookies through your browser settings. Most browsers allow
          you to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>View what cookies are stored on your device</li>
          <li>Delete individual cookies or all cookies</li>
          <li>Block cookies from specific or all websites</li>
          <li>Set preferences for first-party vs. third-party cookies</li>
        </ul>
        <p className="mt-2">
          <strong>Important:</strong> If you block or delete essential cookies (particularly the{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">next-auth.session-token</code>),
          you will be unable to stay signed in to Kruti.io and will need to re-authenticate on
          each visit.
        </p>
        <p className="mt-2">
          For instructions on managing cookies in your browser, please refer to your browser&rsquo;s
          help documentation:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Google Chrome
            </a>
          </li>
          <li>
            <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Apple Safari
            </a>
          </li>
          <li>
            <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Microsoft Edge
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="do-not-track" title="6. Do Not Track Signals">
        <p>
          Kruti.io does not currently respond to &ldquo;Do Not Track&rdquo; (DNT) browser signals.
          However, since we do not use any third-party advertising or analytics tracking cookies,
          your browsing on our platform is not tracked for advertising purposes regardless of
          your DNT setting.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="7. Changes to This Cookie Policy">
        <p>
          We may update this Cookie Policy from time to time to reflect changes in the cookies
          we use or for other operational, legal, or regulatory reasons. We will update the
          &ldquo;Last Updated&rdquo; date at the top of this page when changes are made.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="8. Contact Us">
        <p>
          If you have questions about our use of cookies, please contact us:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mt-2 space-y-1.5">
          <LegalContact />
          <p>Website: kruti.io</p>
        </div>
      </LegalSection>
    </article>
  );
}
