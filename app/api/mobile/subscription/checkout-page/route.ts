/**
 * GET /api/mobile/subscription/checkout-page
 *
 * Serves an HTML page that loads the standard Razorpay JS Checkout (the same
 * SDK the web uses). The mobile app opens this in an in-app browser. After the
 * user pays, the page redirects to a krutimobile:// deep link with the payment
 * IDs; the app then verifies the payment.
 *
 * ORDER-BASED (one-time). Matches /create-order which creates a Razorpay
 * Order (not a subscription) — this works everywhere without eMandate.
 *
 * Query params (built by the mobile app from /create-order response):
 *   order    = razorpay order id (order_xxx)   [required]
 *   key      = razorpay key id (rzp_xxx)        [required]
 *   amount   = amount in the smallest unit (paise/cents)
 *   currency = INR | USD
 *   name     = user name (prefill, optional)
 *   email    = user email (prefill, optional)
 *
 * Place at: app/api/mobile/subscription/checkout-page/route.ts
 */

import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const order = url.searchParams.get("order") || "";
  const key = url.searchParams.get("key") || "";
  const amount = url.searchParams.get("amount") || "";
  const currency = url.searchParams.get("currency") || "INR";
  const name = url.searchParams.get("name") || "";
  const email = url.searchParams.get("email") || "";

  if (!order || !key) {
    return new Response("Missing required params (order, key)", { status: 400 });
  }

  // Absolute URL to the Kruti logo (served from /public) — used both on this
  // page and as the Razorpay checkout merchant logo.
  const logoUrl = `${url.origin}/kruti-mark.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#2563EB" />
  <title>Kruti — Secure Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%);
      min-height: 100vh;
      color: #0F172A;
    }
    body { display: flex; align-items: center; justify-content: center; padding: 24px; }
    .container { text-align: center; max-width: 360px; width: 100%; }
    .logo {
      width: 86px; height: 86px; border-radius: 20px; object-fit: contain;
      display: block; margin: 0 auto 22px; background: #FFFFFF;
      box-shadow: 0 14px 30px rgba(37,99,235,0.24);
    }
    h1 { font-size: 21px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.4px; }
    p { font-size: 13.5px; color: #64748B; line-height: 1.55; }
    .spinner {
      width: 26px; height: 26px; border: 3px solid #DBEAFE; border-top-color: #2563EB;
      border-radius: 50%; animation: spin 0.9s linear infinite; margin: 22px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn {
      margin-top: 18px; background: #2563EB; color: #FFFFFF; padding: 13px 28px;
      border-radius: 12px; border: none; font-size: 14.5px; font-weight: 700;
      cursor: pointer; display: none; box-shadow: 0 8px 20px rgba(37,99,235,0.3);
    }
    .btn:active { transform: scale(0.97); }
    .btn-secondary { background: transparent; color: #64748B; font-size: 13px; font-weight: 600; box-shadow: none; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <img class="logo" src="/kruti-mark.png" alt="Kruti" />
    <h1 id="title">Opening secure checkout…</h1>
    <p id="sub">Razorpay payment is loading. This is the same secure flow used on kruti.io.</p>
    <div class="spinner" id="spinner"></div>
    <button id="retry" class="btn" onclick="openCheckout()">Open Payment Again</button>
    <button id="back" class="btn btn-secondary" onclick="cancelToApp()">Cancel & go back</button>
  </div>
  <script>
    var ORDER_ID = ${JSON.stringify(order)};
    var KEY      = ${JSON.stringify(key)};
    var AMOUNT   = ${JSON.stringify(amount)};
    var CURRENCY = ${JSON.stringify(currency)};
    var UNAME    = ${JSON.stringify(name)};
    var UEMAIL   = ${JSON.stringify(email)};
    var LOGO     = ${JSON.stringify(logoUrl)};
    var APP_SCHEME = "krutimobile://payment-callback";

    function setStatus(title, subtitle, showRetry) {
      document.getElementById("title").textContent = title;
      document.getElementById("sub").textContent   = subtitle;
      document.getElementById("spinner").style.display = showRetry ? "none" : "block";
      document.getElementById("retry").style.display   = showRetry ? "inline-block" : "none";
      document.getElementById("back").style.display    = showRetry ? "inline-block" : "none";
    }

    function returnToApp(params) {
      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(params[k] == null ? "" : params[k]);
      }).join("&");
      window.location.href = APP_SCHEME + "?" + qs;
    }

    function cancelToApp() { returnToApp({ status: "cancelled" }); }

    function openCheckout() {
      setStatus("Opening secure checkout…", "Razorpay is loading. Please wait.", false);

      var opts = {
        key: KEY,
        order_id: ORDER_ID,
        amount: AMOUNT,
        currency: CURRENCY,
        name: "Kruti.io",
        description: "Content Pro — Monthly",
        image: LOGO,
        prefill: { name: UNAME, email: UEMAIL },
        theme: { color: "#2563EB" },
        modal: {
          ondismiss: function () {
            setStatus(
              "Payment cancelled",
              "You closed the payment sheet. Tap below to try again, or cancel to go back.",
              true
            );
          }
        },
        handler: function (response) {
          returnToApp({
            status: "success",
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || ORDER_ID,
            razorpay_signature: response.razorpay_signature
          });
        }
      };

      var rzp = new Razorpay(opts);
      rzp.on("payment.failed", function (resp) {
        var msg = (resp && resp.error && resp.error.description) || "Payment failed";
        setStatus("Payment failed", msg + ". Tap below to try again.", true);
      });
      rzp.open();
    }

    window.addEventListener("load", function () { setTimeout(openCheckout, 400); });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
    },
  });
}
