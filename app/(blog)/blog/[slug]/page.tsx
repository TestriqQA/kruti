import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts, getBlogPost } from "@/lib/blog-data";
import { ArrowLeft, Clock, Tag, Calendar, User, ChevronRight } from "lucide-react";
import SignInButton from "@/components/SignInButton";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: `${post.title} - Kruti.io Blog`,
    description: post.description,
    keywords: post.keywords.join(", "),
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      url: `https://kruti.io/blog/${post.slug}`,
    },
    alternates: {
      canonical: `https://kruti.io/blog/${post.slug}`,
    },
  };
}

function renderMarkdown(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300 mb-6">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
    if (orderedItems.length > 0) {
      elements.push(
        <ol key={key++} className="list-decimal pl-6 space-y-2 text-gray-700 dark:text-gray-300 mb-6">
          {orderedItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ol>
      );
      orderedItems = [];
    }
  }

  function formatInline(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">$1</code>');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-2xl font-bold text-gray-900 dark:text-white mt-10 mb-4">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={key++} className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-2">
          {trimmed.slice(5)}
        </h4>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (orderedItems.length > 0) flushList();
      listItems.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (listItems.length > 0) flushList();
      orderedItems.push(trimmed.replace(/^\d+\.\s/, ""));
    } else {
      flushList();
      elements.push(
        <p
          key={key++}
          className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      );
    }
  }

  flushList();
  return elements;
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const currentIndex = blogPosts.findIndex((p) => p.slug === post.slug);
  const relatedPosts = blogPosts.filter((_, i) => i !== currentIndex).slice(0, 3);

  // JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Kruti.io",
      url: "https://kruti.io",
    },
    mainEntityOfPage: `https://kruti.io/blog/${post.slug}`,
    keywords: post.keywords.join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/blog"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-[#0A66C2] transition-colors"
            >
              Blog
            </Link>
            <SignInButton
              className="text-sm font-medium text-[#0A66C2] hover:text-[#004182] transition-colors"
            >
              Sign In
            </SignInButton>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="px-6 pt-6">
        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:text-[#0A66C2] transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/blog" className="hover:text-[#0A66C2] transition-colors">
            Blog
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 dark:text-white truncate max-w-[300px]">{post.title}</span>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0A66C2] bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
            <Tag className="w-3 h-3" />
            {post.category}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
          <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <User className="w-3.5 h-3.5" />
            {post.author}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
          {post.title}
        </h1>

        {/* Content */}
        <div className="prose-custom">{renderMarkdown(post.content)}</div>

        {/* Keywords/Tags */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap gap-2">
            {post.keywords.map((kw) => (
              <span
                key={kw}
                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* CTA Banner */}
      <section className="max-w-3xl mx-auto px-6 pb-12">
        <div className="bg-gradient-to-br from-[#0A66C2] to-[#004182] rounded-2xl p-8 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
            Create Your LinkedIn Content with AI
          </h2>
          <p className="text-blue-100 mb-6 text-sm">
            Stop struggling with what to post. Kruti.io generates a full month of personalized
            LinkedIn content in minutes.
          </p>
          <SignInButton
            className="inline-flex items-center gap-2 bg-white text-[#0A66C2] font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-blue-50 transition-colors"
          >
            Try Kruti.io Free
          </SignInButton>
        </div>
      </section>

      {/* Related Posts */}
      <section className="border-t border-gray-200 dark:border-gray-800 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            More from the Blog
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {relatedPosts.map((related) => (
              <Link
                key={related.slug}
                href={`/blog/${related.slug}`}
                className="group block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:shadow-md hover:border-[#0A66C2]/30 transition-all"
              >
                <span className="text-xs font-medium text-[#0A66C2] mb-2 block">
                  {related.category}
                </span>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-[#0A66C2] transition-colors mb-2 line-clamp-2">
                  {related.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {related.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
