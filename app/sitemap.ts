import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { PUBLIC_PAGES } from "@/lib/public-pages";
import { blogPosts, postModifiedDate } from "@/lib/blog-data";

/**
 * Serves /sitemap.xml (D-02).
 *
 * Two sources, deliberately:
 *   - lib/public-pages.ts for hand-built routes (homepage, blog index, legal).
 *   - lib/blog-data.ts for posts, so publishing a post puts it in the sitemap
 *     with no edit here. That is the "new pages appear without manual edits"
 *     half of the done-when.
 *
 * Nothing behind sign-in is listed. app/robots.ts disallows those paths, and a
 * sitemap that advertises a URL robots.txt blocks is a Search Console warning.
 *
 * NOTE: middleware.ts must keep /sitemap.xml in CRAWLER_FILES, or an anonymous
 * request is answered with a 307 to the sign-in page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(page.lastModified),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const posts: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(postModifiedDate(post)),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...posts];
}
