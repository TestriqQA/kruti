"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SignInButton from "@/components/SignInButton";
import {
  Linkedin,
  Menu,
  X,
  Search,
  ArrowRight,
  ArrowUpRight,
  Clock,
  BookOpen,
  Target,
  Sparkles,
  BadgeCheck,
  PenLine,
  Zap,
  TrendingUp,
  UserCheck,
  Type,
  BarChart3,
  Flag,
  Wrench,
  Briefcase,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export type BlogCard = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
  image?: string | null;
};

// ── Category → designed cover (gradient + icon) ───────────────────────────────
const categoryStyle: Record<string, { from: string; to: string; icon: LucideIcon }> = {
  Strategy: { from: "from-blue-500", to: "to-indigo-600", icon: Target },
  "AI & Technology": { from: "from-violet-500", to: "to-fuchsia-600", icon: Sparkles },
  "Personal Branding": { from: "from-rose-500", to: "to-pink-600", icon: BadgeCheck },
  "Content Creation": { from: "from-cyan-500", to: "to-blue-600", icon: PenLine },
  Productivity: { from: "from-emerald-500", to: "to-teal-600", icon: Zap },
  "Lead Generation": { from: "from-amber-500", to: "to-orange-600", icon: TrendingUp },
  "Profile Optimization": { from: "from-sky-500", to: "to-cyan-600", icon: UserCheck },
  Copywriting: { from: "from-fuchsia-500", to: "to-purple-600", icon: Type },
  Analytics: { from: "from-indigo-500", to: "to-blue-700", icon: BarChart3 },
  Leadership: { from: "from-orange-500", to: "to-rose-600", icon: Flag },
  "Tools & Reviews": { from: "from-teal-500", to: "to-emerald-600", icon: Wrench },
  Business: { from: "from-slate-600", to: "to-blue-700", icon: Briefcase },
  Sales: { from: "from-green-500", to: "to-emerald-600", icon: DollarSign },
};

function styleFor(category: string) {
  return categoryStyle[category] ?? { from: "from-blue-500", to: "to-indigo-600", icon: BookOpen };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Cover (gradient or image) ─────────────────────────────────────────────────
function Cover({ post, className = "" }: { post: BlogCard; className?: string }) {
  const s = styleFor(post.category);
  const Icon = s.icon;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${s.from} ${s.to} ${className}`}>
      {post.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 [background:radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.4),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:22px_22px]" />
          <Icon className="absolute -bottom-5 -right-4 h-32 w-32 text-white/25 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" />
        </>
      )}
      {/* <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/25 backdrop-blur"> */}
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-blue-900/70 px-2.5 py-1 text-xs font-medium text-blue-100 ring-1 ring-inset ring-blue-700/70 backdrop-blur">
        <Icon className="h-3.5 w-3.5" />
        {post.category}
      </span>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
const navLinks = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#F6F8FB]/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0A0E14]/80">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-12 w-auto" />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`text-[15px] font-medium transition-colors ${l.label === "Blog"
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SignInButton
            className="hidden items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 sm:inline-flex"
          >
            <Linkedin className="h-4 w-4" /> Start free
          </SignInButton>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-slate-200/70 bg-[#F6F8FB] px-5 py-4 dark:border-white/10 dark:bg-[#0A0E14] lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <SignInButton
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white dark:bg-blue-500"
            >
              <Linkedin className="h-4 w-4" /> Start free
            </SignInButton>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function PostCard({ post }: { post: BlogCard }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/40"
    >
      <Cover post={post} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Clock className="h-3.5 w-3.5" /> {post.readTime}
          <span className="text-slate-300 dark:text-slate-600">·</span>
          {fmtDate(post.date)}
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          {post.description}
        </p>
        <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4 dark:border-white/10">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            {initials(post.author)}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{post.author}</span>
          <ArrowUpRight className="ml-auto h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400" />
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BlogIndexClient({ posts }: { posts: BlogCard[] }) {
  const [active, setActive] = useState("All");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    posts.forEach((p) => {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        out.push(p.category);
      }
    });
    return out;
  }, [posts]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      posts.filter(
        (p) =>
          (active === "All" || p.category === active) &&
          (q === "" ||
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)),
      ),
    [posts, active, q],
  );

  const showFeatured = active === "All" && q === "";
  const featured = posts[0];
  const gridPosts = showFeatured ? matches.slice(1) : matches;
  const feat = featured ? styleFor(featured.category) : null;

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900 antialiased dark:bg-[#0A0E14] dark:text-slate-100">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/10">
        <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[360px] bg-[radial-gradient(50%_70%_at_50%_0%,rgba(37,99,235,0.10),transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-blue-400">
            <BookOpen className="h-3.5 w-3.5" /> The Kruti Journal
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem]">
            Insights to grow your{" "}
            <span className="text-blue-600 dark:text-blue-400">LinkedIn presence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Strategy, AI, personal branding, and lead generation - practical playbooks to help you
            post consistently and build authority.
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-blue-400 dark:border-white/10 dark:bg-white/[0.04]">
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Category filter */}
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-6 sm:mx-0 sm:flex-wrap sm:px-0">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${active === c
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-blue-500/40"
                }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Featured */}
        {showFeatured && featured && feat && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group mb-12 grid overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all duration-300 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/40 lg:grid-cols-2"
          >
            <Cover post={featured} className="min-h-[260px] lg:min-h-full" />
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5" /> Featured
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mt-3 line-clamp-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                {featured.description}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {initials(featured.author)}
                </span>
                <div className="text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{featured.author}</p>
                  <p className="text-slate-400 dark:text-slate-500">
                    {fmtDate(featured.date)} · {featured.readTime}
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Grid */}
        {gridPosts.length > 0 ? (
          <div className="grid gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5">
              <Search className="h-5 w-5" />
            </div>
            <p className="font-display text-lg font-semibold">No articles found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Try a different search or category.
            </p>
            <button
              onClick={() => {
                setQuery("");
                setActive("All");
              }}
              className="mt-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:text-slate-300"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-16 text-center dark:bg-blue-600 sm:px-12">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_0%,#60a5fa,transparent_60%)]" />
          <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to transform your LinkedIn presence?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-base text-slate-300 dark:text-blue-50">
            Generate a full month of AI-powered LinkedIn content in minutes. Try Kruti.io free.
          </p>
          <SignInButton
            className="relative mt-8 inline-flex items-center gap-2.5 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition-transform hover:-translate-y-0.5"
          >
            <Linkedin className="h-5 w-5" /> Get started free <ArrowRight className="h-4 w-4" />
          </SignInButton>
        </div>
      </section>
    </div>
  );
}
