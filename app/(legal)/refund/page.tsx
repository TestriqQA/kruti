import { Metadata } from "next";
import LegalContact from "@/components/LegalContact";
import Link from "next/link";
import LegalSection from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Refund Policy | Kruti.io",
  description:
    "Refund and cancellation policy for Kruti.io subscriptions processed via Razorpay.",
};

export default function RefundPolicyPage() {
  return (
    <article>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Refund Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: March 10, 2026 &middot; Effective Date: March 10, 2026
        </p>
      </div>

      <LegalSection id="overview" title="1. Overview">
        <p>
          This Refund Policy applies to all subscription payments for <strong>Kruti.io</strong>,
          operated by <strong>Cinute InfoMedia</strong> All payments are processed securely
          through <strong>Razorpay</strong>.
        </p>
        <p>
          Our subscription plans are:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Content Pro (INR):</strong> &#8377;999 per month</li>
          <li><strong>Content Pro (USD):</strong> $19 per month</li>
        </ul>
        <p>
          Please read this policy carefully before subscribing. By completing a payment, you
          acknowledge that you have read and agree to this Refund Policy.
        </p>
      </LegalSection>

      <LegalSection id="free-trial" title="2. Free Trial Period">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Every new user receives a <strong>7-day free trial</strong> automatically upon their
            first sign-in via LinkedIn.
          </li>
          <li>
            No payment information is required to start the trial.
          </li>
          <li>
            The trial provides full access to all Content Pro features, including AI content
            generation, image creation, scheduling, and LinkedIn auto-posting.
          </li>
          <li>
            The trial expires automatically after 7 days. You will not be charged unless you
            actively subscribe.
          </li>
          <li>
            We encourage you to use the trial period to fully evaluate the Service before
            committing to a paid subscription.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="subscription-cancellation" title="3. Subscription Cancellation">
        <p>You may cancel your subscription at any time:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>From the app:</strong> Go to Settings &gt; Subscription &gt; Cancel Subscription.
          </li>
          <li>
            <strong>Via email:</strong> Send a cancellation request to{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>.
          </li>
        </ul>
        <p>When you cancel:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Your subscription remains active until the <strong>end of the current billing
            period</strong>.
          </li>
          <li>
            You will continue to have full access to all features until the period expires.
          </li>
          <li>
            No further charges will be made after cancellation.
          </li>
          <li>
            <strong>No partial-month refunds</strong> are provided for mid-cycle cancellations.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="refund-eligibility" title="4. Refund Eligibility">
        <p>Refunds may be issued in the following circumstances:</p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          a) Within 48 Hours of First Payment
        </h3>
        <p>
          If you request a refund within 48 hours of your first subscription payment and have
          not generated any content using the platform, you are eligible for a <strong>full
          refund</strong>.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          b) Service Disruption
        </h3>
        <p>
          If the platform is unavailable for more than <strong>72 consecutive hours</strong>{" "}
          during a billing period due to issues on our end (not including scheduled maintenance
          communicated in advance), you may be eligible for a pro-rated refund for the affected
          period.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          c) Billing Errors
        </h3>
        <p>
          If you were charged incorrectly (e.g., duplicate charges, wrong amount), you are
          entitled to a <strong>full refund</strong> of the erroneous charge.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          d) Not Eligible for Refund
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Dissatisfaction with the quality of AI-generated content (content quality is
            subjective and depends on user inputs, profile data, and AI model capabilities)
          </li>
          <li>
            Failure to cancel before the renewal date
          </li>
          <li>
            Usage of the Service during the billing period beyond initial exploration
          </li>
          <li>
            Changes in LinkedIn&rsquo;s API that affect features beyond our control
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="refund-process" title="5. How to Request a Refund">
        <p>To request a refund:</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Email{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>{" "}
            with the subject line <strong>&ldquo;Refund Request&rdquo;</strong>.
          </li>
          <li>
            Include your registered email address, the reason for the refund request, and the
            date of the payment in question.
          </li>
          <li>
            Our team will review your request and respond within <strong>3 business days</strong>.
          </li>
          <li>
            Approved refunds will be processed within <strong>5-7 business days</strong> and
            credited to your original payment method via Razorpay.
          </li>
        </ol>
      </LegalSection>

      <LegalSection id="razorpay-processing" title="6. Payment Processing by Razorpay">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            All subscription payments are processed by <strong>Razorpay Software Pvt. Ltd.</strong>,
            a PCI-DSS compliant payment gateway.
          </li>
          <li>
            Kruti.io does not store your credit card numbers, debit card numbers, bank account
            details, UPI IDs, or any sensitive payment instrument data.
          </li>
          <li>
            Razorpay&rsquo;s refund processing timelines may vary. Typically, refunds appear
            within 5-10 business days depending on your bank or payment provider.
          </li>
          <li>
            For international refunds (USD payments), currency conversion rates and any
            associated fees are determined by your bank.
          </li>
          <li>
            Razorpay&rsquo;s own policies and terms may also apply. Please review{" "}
            <a href="https://razorpay.com/terms/" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Razorpay&rsquo;s Terms of Service
            </a>{" "}
            for additional details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="chargebacks" title="7. Chargebacks and Disputes">
        <p>
          If you have a billing concern, we strongly encourage you to contact us at{" "}
          <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>{" "}
          <strong>before</strong> filing a chargeback with your bank or payment provider.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            We are committed to resolving billing disputes promptly and fairly.
          </li>
          <li>
            Chargebacks filed without prior communication with our support team may result in
            temporary suspension of your account pending investigation.
          </li>
          <li>
            Fraudulent chargebacks (where the Service was used and accessed) may result in
            permanent account termination.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="contact" title="8. Contact Us">
        <p>
          For any questions about refunds, cancellations, or billing, please contact us:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mt-2 space-y-1.5">
          <LegalContact />
          <p>Website: kruti.io</p>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
          Please include your registered email address and subscription details in all
          refund-related communications for faster resolution.
        </p>
      </LegalSection>
    </article>
  );
}
