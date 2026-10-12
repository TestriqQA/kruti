/**
 * Local harness for the code-rendered image layouts (lib/render-card.tsx).
 *
 * Renders one sample per layout so a change to the type scale, the themes or a
 * layout can be eyeballed across all of them at once, without generating a post
 * or spending a token. There is no other way to see these: the output is a PNG
 * written to Blob storage, so a regression in, say, the comparison panel would
 * otherwise only surface on a real user's post.
 *
 * DEV ONLY. Not linked from anywhere, and 404s in production - the route sits
 * outside APP_ROUTE_PREFIXES in middleware.ts, so it would otherwise be
 * publicly reachable and would let anyone burn CPU rendering images.
 */
import { notFound } from "next/navigation";
import { getImageCategory } from "@/lib/image-categories";
import { renderDesignedImage, type DesignBrief } from "@/lib/render-card";

export const dynamic = "force-dynamic";

const SAMPLES: Array<{ categoryId: string; brief: DesignBrief; slide?: { index: number; total: number } }> = [
  {
    categoryId: "infographic",
    brief: {
      themeId: "paper",
      headline: "Why Roadmaps Slip",
      subheadline: "Three things that quietly eat every quarter",
      nodes: ["Unscoped Discovery", "Silent Dependencies", "Review Queues"],
      cards: ["Fewer Handoffs", "Clear Owners"],
    },
  },
  {
    categoryId: "framework-diagram",
    brief: {
      themeId: "ink",
      headline: "The Churn Loop",
      subheadline: "How a missed onboarding step compounds",
      nodes: ["Signup", "No First Win", "Low Usage", "Cancel"],
      cards: ["Fix Step Two"],
    },
  },
  {
    categoryId: "myth-vs-fact",
    brief: {
      themeId: "mono",
      headline: "Pricing Myths",
      subheadline: "What founders get wrong about raising prices",
      nodes: ["Price cuts win deals", "Price raises filter buyers"],
      bodyText: "Discounting attracts the customers least likely to stay.",
    },
  },
  {
    categoryId: "big-stat-hero",
    brief: {
      themeId: "slate",
      headline: "Of Churn Happens In Week One",
      subheadline: "Before anyone has logged in twice",
      bodyText: "63%",
    },
  },
  {
    categoryId: "quote-card",
    brief: {
      themeId: "clay",
      headline: "On shipping",
      subheadline: "Lesson from three platform rewrites",
      bodyText: "The rewrite was never the risk. Not deciding was.",
    },
  },
  {
    categoryId: "checklist-card",
    brief: {
      themeId: "sage",
      headline: "Before You Ship",
      subheadline: "Five minutes that save a rollback",
      nodes: ["Migration Applied", "Flags Default Off", "Rollback Tested", "Owner On Call"],
    },
  },
  {
    categoryId: "announcement-card",
    brief: {
      themeId: "indigo",
      headline: "We Are Hiring",
      subheadline: "Senior product engineer, remote across IST hours",
      nodes: ["Remote", "Full Time"],
      cards: ["Apply Now"],
    },
  },
  {
    categoryId: "x-screenshot",
    brief: {
      themeId: "teal",
      headline: "On review queues",
      subheadline: "2 hours ago",
      bodyText: "Your PR review time is a product decision. Treat a two-day queue as a two-day outage.",
    },
  },
  {
    categoryId: "before-after",
    brief: {
      themeId: "block",
      headline: "Standup, Rebuilt",
      subheadline: "Same meeting, fifteen minutes shorter",
      nodes: ["Round-robin updates", "Blockers only, written first"],
    },
  },
  {
    categoryId: "infographic",
    brief: {
      themeId: "plum",
      headline: "Stop Guessing",
      subheadline: "The takeaway: write the decision down before you build",
      nodes: [],
      cards: [],
    },
    slide: { index: 3, total: 4 },
  },
];

export default async function RenderPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const results = await Promise.all(
    SAMPLES.map(async (s, i) => {
      const category = getImageCategory(s.categoryId);
      try {
        const buf = await renderDesignedImage({
          category,
          brief: s.brief,
          seed: `preview-${i}`,
          author: { name: "Jayesh Mistry", headline: "Senior QA Lead at Testriq" },
          slide: s.slide,
        });
        // Optional: set RENDER_PREVIEW_DIR to also drop the PNGs on disk, for
        // inspecting a layout at full 1080px rather than scaled into the grid.
        try {
          const dir = process.env.RENDER_PREVIEW_DIR;
          if (dir) {
            const fs = await import("node:fs");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(`${dir}/${i}-${s.categoryId}.png`, buf);
          }
        } catch {
          /* preview convenience only */
        }
        return {
          label: `${category.label} (${category.genApproach})${s.slide ? " - carousel slide" : ""}`,
          theme: s.brief.themeId ?? "auto",
          src: `data:image/png;base64,${buf.toString("base64")}`,
          bytes: buf.length,
          error: null as string | null,
        };
      } catch (err) {
        console.error(`[render-preview] ${category.id} failed:`, err);
        return {
          label: category.label,
          theme: s.brief.themeId ?? "auto",
          src: null,
          bytes: 0,
          error: (err as Error).message,
        };
      }
    })
  );

  const failed = results.filter((r) => r.error).length;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "#111", color: "#eee" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Render preview</h1>
      <p style={{ fontSize: 13, color: failed ? "#f87171" : "#4ade80", marginBottom: 20 }}>
        {results.length - failed}/{results.length} rendered
        {failed > 0 ? ` - ${failed} FAILED` : ""}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {results.map((r, i) => (
          <div key={i} style={{ border: "1px solid #333", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6, color: "#aaa" }}>
              {r.label} · theme: {r.theme} · {Math.round(r.bytes / 1024)}KB
            </div>
            {r.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.src} alt={r.label} style={{ width: "100%", display: "block", borderRadius: 4 }} />
            ) : (
              <pre style={{ color: "#f87171", fontSize: 11, whiteSpace: "pre-wrap" }}>{r.error}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
