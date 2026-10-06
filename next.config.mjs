import { buildRedirects, buildCanonicalHostRedirect } from "./lib/redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  /**
   * D-10 (one canonical hostname) and D-19 (redirect map).
   *
   * Order matters: the host redirect runs first, so a request to
   * www.kruti.io/blog/old-slug lands on kruti.io/blog/old-slug and is then
   * redirected on to the new slug. Two hops only ever happen for a www request
   * to a renamed URL; everything else is a single 301.
   */
  async redirects() {
    return [...buildCanonicalHostRedirect(), ...buildRedirects()];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "**.linkedin.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://media.licdn.com https://*.linkedin.com https://*.public.blob.vercel-storage.com",
              "font-src 'self'",
              "connect-src 'self' https://api.razorpay.com https://lux.razorpay.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
