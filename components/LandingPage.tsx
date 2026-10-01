"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import {
  Linkedin,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Check,
  X,
  Menu,
  ChevronDown,
  Star,
  Target,
  FileText,
  Image as ImageIcon,
  Calendar,
  Newspaper,
  Zap,
  Sparkles,
  AlertCircle,
  Send,
  ShieldCheck,
  CreditCard,
  Clock,
  RefreshCw,
} from "lucide-react";
import Footer from "@/components/Footer";

// ──────────────────────────────────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────────────────────────────────

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

const steps = [
  {
    n: "01",
    icon: Linkedin,
    title: "Connect your LinkedIn",
    desc: "Sign in securely. We read your profile, headline, and experience to learn your authentic voice.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Generate your strategy",
    desc: "AI builds a personalized content plan - themes, pillars, and post types. No prompts to write.",
  },
  {
    n: "03",
    icon: Send,
    title: "Publish & grow",
    desc: "Review the drafts, add an image in one click, and publish straight to LinkedIn.",
  },
];

const stats = [
  { value: "30", label: "AI posts every month" },
  { value: "~5 min", label: "to a full month of content" },
  { value: "0", label: "prompts to write" },
  { value: "100%", label: "your authentic voice" },
];

const features = [
  {
    icon: Target,
    title: "Personalized strategy",
    desc: "A data-driven roadmap built around your expertise, industry, and audience - so every post has a purpose.",
  },
  {
    icon: FileText,
    title: "30 ready-to-publish posts",
    desc: "Thought leadership, tips, stories, questions, and listicles - written in your voice, every month.",
  },
  {
    icon: ImageIcon,
    title: "Professional AI images",
    desc: "Eye-catching, on-brand visuals for every post. No design skills, no stock-photo hunting.",
  },
  {
    icon: Calendar,
    title: "Visual content calendar",
    desc: "Plan, schedule, and track a full month of LinkedIn content in one clean view.",
  },
  {
    icon: Newspaper,
    title: "Newsletter drafts",
    desc: "Full LinkedIn newsletter editions - hooks, sections, insights, and CTAs - ready to send.",
  },
  {
    icon: Zap,
    title: "One-click publishing",
    desc: "Review, refine, and publish to LinkedIn without copy-paste. Your content goes live in seconds.",
  },
];

const withoutKruti = [
  "Spending 2+ hours writing a single post",
  "Running out of ideas by Wednesday",
  "Inconsistent posting that kills your reach",
  "Generic content that sounds like everyone else",
];

const withKruti = [
  "30 posts generated in under 5 minutes",
  "Fresh themes and ideas every single batch",
  "Consistent daily posting on autopilot",
  "Content that sounds like you - it learns your voice",
];

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Marketing Director, SaaS",
    initials: "PS",
    text: "I went from posting once a month to 5x a week. Kruti.io generates content that actually sounds like me - my network noticed the difference immediately.",
  },
  {
    name: "Rahul Menon",
    role: "Founder & CEO, FinTech",
    initials: "RM",
    text: "We used to spend 3 hours per post. Now our entire month of content is ready in minutes. The strategy is spot-on for our industry.",
  },
  {
    name: "Aisha Patel",
    role: "HR Consultant",
    initials: "AP",
    text: "The calendar and auto-publishing changed my game. I focus on my clients while Kruti.io keeps my LinkedIn active and growing.",
  },
];

const pricingIncludes = [
  "30 AI-generated posts per month",
  "Professional image generation",
  "Content calendar & scheduling",
  "One-click LinkedIn publishing",
  "Personalized content strategy",
  "Newsletter drafts",
];

const faqs = [
  {
    q: "Is my LinkedIn account safe? Will I get banned?",
    a: "Absolutely safe. Kruti.io uses LinkedIn's official API and OAuth 2.0 - the same authorized method used by major platforms like Hootsuite and Buffer. We never store your password, never use scrapers or automation, and never violate LinkedIn's terms. Your account is never at risk because we only publish content you explicitly approve.",
  },
  {
    q: "Will the AI-generated posts sound like me?",
    a: "Yes. Kruti.io reads your LinkedIn profile - your headline, about section, experience, and activity - to understand your tone, expertise, and audience. Every post matches your authentic professional voice, not generic AI-speak.",
  },
  {
    q: "Can I edit posts before publishing?",
    a: "Always. Every post is created as a draft first. You can review, edit, rewrite, or discard any post before marking it ready. You stay in full control of what goes live.",
  },
  {
    q: "Do I need to write prompts or instructions?",
    a: "No. Unlike other AI tools, Kruti.io doesn't need prompts. It builds your content strategy automatically from your LinkedIn profile and industry. Just click generate.",
  },
  {
    q: "What happens after the 7-day free trial?",
    a: "After the trial it's one simple plan at ₹999/month (or $19/month for international users) - everything included, no tiers or add-ons. You can cancel anytime from your account settings with no lock-in.",
  },
  {
    q: "How does billing work and can I cancel anytime?",
    a: "Payments are processed securely by Razorpay and billed monthly. You can cancel or manage your subscription anytime from your account settings - you keep access until the end of your billing cycle.",
  },
];

const trust = ["Free to start", "No credit card", "Cancel anytime", "Official LinkedIn API"];

const pricingTrust = [
  { icon: Clock, label: "7-day free trial" },
  { icon: CreditCard, label: "No credit card to start" },
  { icon: RefreshCw, label: "Cancel anytime" },
  { icon: ShieldCheck, label: "Secure payments via Razorpay" },
];

const mockPosts = [
  { title: "3 lessons from scaling our team 5 → 50", type: "Story", status: "Ready", dot: "bg-blue-500" },
  { title: "The hiring mistake most founders make", type: "Tips", status: "Scheduled", dot: "bg-violet-500" },
  { title: "Why we stopped chasing vanity metrics", type: "Thought", status: "Draft", dot: "bg-amber-500" },
  { title: "A simple framework for better 1:1s", type: "How-to", status: "Published", dot: "bg-emerald-500" },
];

// ──────────────────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────────────────

function Brand() {
  return (
    <a href="#overview" className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
    </a>
  );
}

function CTAButton({ onClick, children, full }: { onClick: () => void; children: React.ReactNode; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 ${
        full ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
      {children}
    </span>
  );
}

function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ready: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    Scheduled: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    Draft: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
    Published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-900 dark:text-slate-100">{q}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            open ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
        </div>
      </div>
    </div>
  );
}

function ProductPanel() {
  return (
    <div className="animate-fade-up [animation-delay:160ms] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Content workspace
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <Sparkles className="h-3 w-3" /> 5 posts ready
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {mockPosts.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${p.dot}`} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{p.title}</span>
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400 sm:inline">
              {p.type}
            </span>
            <StatusPill status={p.status} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-white/10">
        <span>This week · Mon-Fri · 9:00 AM</span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Auto-publishing on
        </span>
      </div>
    </div>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show once the user has scrolled past the hero area.
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll back to top"
      className={`fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function LandingPage({ callbackUrl }: { callbackUrl?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignIn = () => {
    signIn("linkedin", { callbackUrl: callbackUrl || "/dashboard" });
  };

  const isRedirect = callbackUrl && callbackUrl !== "/dashboard" && callbackUrl !== "/";

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900 antialiased dark:bg-[#0A0E14] dark:text-slate-100">
      {isRedirect && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          Please sign in to access that page.
        </div>
      )}

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#F6F8FB]/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0A0E14]/80">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />

          {/* Desktop links */}
          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignIn}
              className="hidden items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 sm:inline-flex"
            >
              <Linkedin className="h-4 w-4" /> Start free
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-200/70 bg-[#F6F8FB] px-5 py-4 dark:border-white/10 dark:bg-[#0A0E14] lg:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-blue-300"
                >
                  {l.label}
                </a>
              ))}
              <button
                onClick={handleSignIn}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white dark:bg-blue-500"
              >
                <Linkedin className="h-4 w-4" /> Start free
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section id="overview" className="relative scroll-mt-20 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[420px] bg-[radial-gradient(50%_70%_at_50%_0%,rgba(37,99,235,0.10),transparent_70%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-12 pt-6 sm:px-8 sm:pb-20 sm:pt-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Powered by AI, crafted with love in Mumbai
              </span>
            </div>
            <h1 className="animate-fade-up [animation-delay:80ms] mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Stop writing LinkedIn posts.{" "}
              <span className="text-blue-600 dark:text-blue-400">Start growing your brand.</span>
            </h1>
            <p className="animate-fade-up [animation-delay:140ms] mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Kruti.io turns your LinkedIn profile into a content engine - generating 30 strategic
              posts, professional images, and newsletters every month, all in your authentic voice.
            </p>
            <div className="animate-fade-up [animation-delay:200ms] mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={handleSignIn}
                className="group inline-flex items-center gap-2.5 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <Linkedin className="h-5 w-5" />
                Start creating for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-1 text-base font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
              >
                See how it works <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="animate-fade-up [animation-delay:260ms] mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-500">
              {trust.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-blue-500" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <ProductPanel />
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section aria-label="Key metrics" className="border-y border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-4 py-8 text-center sm:py-10 ${
                i % 2 === 0 ? "border-r border-slate-100 dark:border-white/10" : ""
              } ${i < 2 ? "border-b border-slate-100 dark:border-white/10 lg:border-b-0" : ""} ${
                i === 2 ? "lg:border-r lg:border-slate-100 lg:dark:border-white/10" : ""
              }`}
            >
              <div className="font-display text-3xl font-bold text-blue-600 dark:text-blue-400 sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Section id="how" className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          From zero to 30 posts in three steps
        </h2>
        <div className="relative mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {/* connecting line behind the step icons (desktop) */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-blue-500/30 sm:block"
          />
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex items-center gap-3">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 dark:bg-blue-500">
                  <s.icon className="h-6 w-6" />
                </span>
                <span className="font-display text-2xl font-bold text-slate-200 dark:text-white/15">{s.n}</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <Section id="features" className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        <Eyebrow>Everything you need</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          A whole content team, quietly working
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <Section className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        <Eyebrow>Sound familiar?</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          The old way, and a calmer way
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Without Kruti.io</p>
            <ul className="mt-5 space-y-3.5">
              {withoutKruti.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5">
                    <X className="h-3 w-3" />
                  </span>
                  <span className="text-[15px] text-slate-500 dark:text-slate-400">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 sm:p-8 dark:border-blue-500/20 dark:bg-blue-500/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">With Kruti.io</p>
            <ul className="mt-5 space-y-3.5">
              {withKruti.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <Section className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        <Eyebrow>Loved by professionals</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Trusted by founders &amp; marketers
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                “{t.text}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {t.initials}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Section id="pricing" className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Simple pricing</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            One plan. Everything included.
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            No tiers, no add-ons, no surprises. Start with a 7-day free trial.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03] sm:grid sm:grid-cols-2">
          <div className="border-b border-slate-100 p-8 dark:border-white/10 sm:border-b-0 sm:border-r">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              7-day free trial
            </span>
            <div className="mt-5 flex items-end gap-1.5">
              <span className="font-display text-5xl font-bold tracking-tight">₹999</span>
              <span className="mb-1.5 text-slate-500 dark:text-slate-400">/month</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">or $19/month for international users</p>
            <div className="mt-7">
              <CTAButton onClick={handleSignIn} full>
                <Linkedin className="h-4 w-4" /> Start your free trial
              </CTAButton>
              <p className="mt-3 text-center text-xs text-slate-400">No credit card required. Cancel anytime.</p>
            </div>
          </div>
          <div className="p-8">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Everything included</p>
            <ul className="mt-4 space-y-3">
              {pricingIncludes.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="text-[15px] text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust row */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {pricingTrust.map((t) => (
            <span
              key={t.label}
              className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
            >
              <t.icon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              {t.label}
            </span>
          ))}
        </div>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section id="faq" className="border-t border-slate-200 py-14 dark:border-white/10 sm:py-20">
        {/* SEO: FAQPage structured data for Google rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Left: heading + CTA panel */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Questions, answered
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
              Everything you need to know about Kruti.io - how it works, your account safety, and billing.
            </p>
            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="font-display text-base font-semibold">Still have questions?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Start your 7-day free trial - no credit card needed - and see it work for yourself.
              </p>
              <button
                onClick={handleSignIn}
                className="group mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <Linkedin className="h-4 w-4" />
                Start creating for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
          {/* Right: accordion */}
          <div className="border-t border-slate-200 dark:border-white/10">
            {faqs.map((f) => (
              <FAQItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <Section className="py-14 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-16 text-center dark:bg-blue-600 sm:px-12">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_0%,#60a5fa,transparent_60%)]" />
          <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to build your brand on LinkedIn?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-base text-slate-300 dark:text-blue-50">
            Join the founders and marketers growing their presence with content that actually sounds
            human.
          </p>
          <button
            onClick={handleSignIn}
            className="relative mt-8 inline-flex items-center gap-2.5 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition-transform hover:-translate-y-0.5"
          >
            <Linkedin className="h-5 w-5" />
            Get started free
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="relative mt-5 text-xs text-slate-400 dark:text-blue-100/80">
            Built by Cinute Digital Pvt. Ltd., Mumbai, India.
          </p>
        </div>
      </Section>

      <Footer />

      <ScrollToTopButton />
    </div>
  );
}
