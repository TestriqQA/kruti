"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

export type Currency = "INR" | "USD";

export const PRICE: Record<Currency, { symbol: string; amount: number }> = {
  INR: { symbol: "₹", amount: 999 },
  USD: { symbol: "$", amount: 19 },
};

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * The Razorpay subscribe flow, shared by every surface that can sell a plan:
 * the /subscribe page and the in-dashboard paywall. Keeping one copy means the
 * dev bypass, the error handling and the post-payment session refresh can't
 * drift apart between them.
 */
export function useCheckout(defaultCurrency: Currency = "INR") {
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const { data: session, update } = useSession();
  const { toast } = useToast();

  // Load the Razorpay checkout script once.
  useEffect(() => {
    if (document.querySelector(`script[src='${RAZORPAY_SRC}']`)) return;
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      const data = await res.json();

      // DEV bypass - no Razorpay keys configured, subscription auto-activated.
      if (data.dev && data.redirectUrl) {
        await update();
        window.location.href = data.redirectUrl;
        return;
      }

      // Surface server-side errors (e.g. Razorpay misconfiguration) rather than
      // leaving a silent dead button.
      if (!res.ok || data.error) {
        console.error("Checkout failed:", data.error ?? res.status, data.details ?? "");
        toast(
          data.error
            ? `Couldn't start payment: ${data.error}`
            : "Couldn't start payment right now. Please try again in a moment.",
          "error"
        );
        setLoading(false);
        return;
      }

      if (!data.subscriptionId || !data.keyId) {
        console.error("Missing subscriptionId or keyId from API");
        toast("Couldn't start payment right now. Please try again in a moment.", "error");
        setLoading(false);
        return;
      }

      // `new window.Razorpay()` throws if the script hasn't landed yet, and the
      // modal would never appear.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        toast("Payment system is still loading. Please try again in a moment.", "error");
        setLoading(false);
        return;
      }

      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "Kruti.io",
        description: `Content Pro - ${PRICE[currency].symbol}${PRICE[currency].amount}/month`,
        handler: async (response: {
          razorpay_subscription_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/subscription/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              // Refresh the session so the new status reaches the cookie claims,
              // then hard-navigate so the locked layout re-renders unlocked.
              await update();
              window.location.href = "/dashboard?subscribed=true";
            } else {
              console.error("Payment verification failed:", verifyData.error);
              toast(
                "Payment verification failed. If you were charged, please contact support.",
                "error"
              );
              setLoading(false);
            }
          } catch (err) {
            console.error("Verify error:", err);
            toast(
              "Payment verification failed. If you were charged, please contact support.",
              "error"
            );
            setLoading(false);
          }
        },
        prefill: {
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        },
        theme: { color: "#0A66C2" },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Checkout error:", err);
      toast("Something went wrong while starting payment. Please try again.", "error");
      setLoading(false);
    }
  }, [currency, session, toast, update]);

  return { loading, currency, setCurrency, subscribe };
}
