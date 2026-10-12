import satori from "satori";
import sharp from "sharp";
import type { ImageCategory } from "@/lib/image-categories";
import { resolveTheme, type ImageTheme } from "@/lib/image-themes";
import { getRenderFonts, FONT_FAMILY } from "@/lib/og-fonts";

/**
 * ─── Code-rendered post images ───────────────────────────────────────────────
 *
 * Twelve of the seventeen image categories are information design: a headline, a
 * supporting line, some short labels, laid out on a structure. Those were being
 * produced by asking a diffusion model, in prose, to set a headline at "about 12
 * to 18 percent of the image height", spell every label correctly, and draw no
 * border - none of which a diffusion model can be instructed to do reliably,
 * because it is sampling pixels, not laying out type.
 *
 * That is the whole reason the images came back with misspelled labels, headlines
 * too small to read on a phone, and a different look every time. The prompt was
 * not the problem; the renderer was.
 *
 * So these formats are now laid out in code - the same brief JSON the model
 * already returns (headline, subheadline, bodyText, nodes, cards) rendered
 * through Satori via next/og. The text is real text:
 *
 *   - spelling and wrapping are exact, because nothing is being imagined;
 *   - type scale is enforced in CSS, so the headline cannot come out small;
 *   - the palette is applied from tokens, so a set looks like a set;
 *   - it costs nothing per image and takes ~200ms rather than 10-20s, which
 *     also takes the 60s function limit off the table for carousels.
 *
 * The five genuinely photographic categories (one meme, four realistic scenes)
 * still go to the image model - that IS what it is good at. See lib/imagen.ts
 * for the split.
 *
 * ── The pipeline ──
 * Satori lays the JSX out and emits an SVG, then sharp rasterises it to PNG.
 *
 * Not next/og, which wraps the same Satori but bundles its own resvg and
 * fallback font: on Windows its Node build resolves that font to a malformed
 * path (`.\file:\C:\...`) and throws ERR_INVALID_URL at module init, before any
 * font you pass it is even considered. That makes every image fail in local dev
 * on this team's machines. Driving Satori directly also means sharp - already a
 * dependency for image cropping - does the raster step, so there is no second
 * native module to ship.
 *
 * Satori converts text to SVG <path> data, so the SVG handed to sharp carries no
 * font references at all and rasterises identically everywhere.
 *
 * ── Satori constraints, for anyone editing a layout ──
 * Flexbox only (no grid, no float). Any element with more than one child needs
 * an explicit `display: flex`. Only the loaded font weights (400/600/800) exist.
 * Keep to these and the output is deterministic.
 */

export const IMAGE_SIZE = 1080;
const PAD = 76;

/** The brief fields a layout can use. A subset of ImageBrief. */
export interface DesignBrief {
  headline: string;
  subheadline?: string;
  bodyText?: string;
  nodes?: string[];
  cards?: string[];
  themeId?: string;
}

export interface RenderOptions {
  category: ImageCategory;
  brief: DesignBrief;
  /** Stable string (the post id) so an unknown themeId falls back consistently. */
  seed: string;
  /** Used only by the social-screenshot format. */
  author?: { name?: string | null; headline?: string | null };
  /** Set for carousel slides so the set gets a position indicator. */
  slide?: { index: number; total: number };
}

// ─── Type scale ──────────────────────────────────────────────────────────────
// Sized off character count rather than a fixed value: the brief caps headlines
// at 34 characters, so this keeps a short headline genuinely large without
// letting a long one wrap to three lines.

function headlineSize(text: string): number {
  const n = text.trim().length;
  if (n <= 16) return 112;
  if (n <= 24) return 94;
  if (n <= 34) return 80;
  return 66;
}

function heroSize(text: string): number {
  const n = text.trim().length;
  if (n <= 4) return 300;
  if (n <= 8) return 220;
  if (n <= 18) return 150;
  if (n <= 40) return 104;
  if (n <= 90) return 72;
  return 54;
}

function nodeSize(count: number): number {
  if (count <= 2) return 44;
  if (count === 3) return 40;
  if (count === 4) return 36;
  return 32;
}

// ─── Shared pieces ───────────────────────────────────────────────────────────

/** The short accent bar that anchors the top-left of most layouts. */
function AccentRule({ t }: { t: ImageTheme }) {
  return (
    <div
      style={{
        display: "flex",
        width: 96,
        height: 10,
        borderRadius: 999,
        backgroundColor: t.accent,
      }}
    />
  );
}

function Headline({ text, t, align = "left" }: { text: string; t: ImageTheme; align?: "left" | "center" }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: headlineSize(text),
        fontWeight: 800,
        lineHeight: 1.04,
        letterSpacing: -2,
        color: t.text,
        textAlign: align,
        ...(align === "center" ? { justifyContent: "center" } : {}),
      }}
    >
      {text}
    </div>
  );
}

function Subhead({ text, t, align = "left" }: { text: string; t: ImageTheme; align?: "left" | "center" }) {
  if (!text) return null;
  return (
    <div
      style={{
        display: "flex",
        fontSize: 34,
        fontWeight: 400,
        lineHeight: 1.35,
        color: t.textMuted,
        textAlign: align,
        ...(align === "center" ? { justifyContent: "center" } : {}),
      }}
    >
      {text}
    </div>
  );
}

/** Bottom chip row for the optional `cards` labels. */
function CardChips({ cards, t }: { cards: string[]; t: ImageTheme }) {
  if (cards.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
      {cards.map((c) => (
        <div
          key={c}
          style={{
            display: "flex",
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 26,
            paddingRight: 26,
            borderRadius: 999,
            backgroundColor: t.surface,
            border: `2px solid ${t.border}`,
            color: t.text,
            fontSize: 27,
            fontWeight: 600,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

/** Carousel position dots, so a set visibly reads as one set. */
function SlideDots({ slide, t }: { slide: { index: number; total: number }; t: ImageTheme }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 12, alignItems: "center" }}>
      {Array.from({ length: slide.total }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: i === slide.index ? 44 : 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: i === slide.index ? t.accent : t.border,
          }}
        />
      ))}
    </div>
  );
}

function Tick({ t }: { t: ImageTheme }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6 9 17l-5-5"
        stroke={t.onAccent}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

/** designed-infographic, carousel-hint, and the fallback for anything unmapped. */
function Infographic({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const nodes = brief.nodes ?? [];
  const size = nodeSize(nodes.length);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <AccentRule t={t} />
        <Headline text={brief.headline} t={t} />
        <Subhead text={brief.subheadline ?? ""} t={t} />
      </div>

      {nodes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {nodes.map((n, i) => (
            <div
              key={n}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 24,
                backgroundColor: t.surface,
                border: `2px solid ${t.border}`,
                borderRadius: 24,
                paddingTop: 22,
                paddingBottom: 22,
                paddingLeft: 24,
                paddingRight: 30,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 60,
                  height: 60,
                  borderRadius: 999,
                  backgroundColor: t.accent,
                  color: t.onAccent,
                  fontSize: 30,
                  fontWeight: 800,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: "flex", fontSize: size, fontWeight: 600, color: t.text }}>{n}</div>
            </div>
          ))}
        </div>
      )}

      <CardChips cards={brief.cards ?? []} t={t} />
    </>
  );
}

/** framework-diagram, timeline-roadmap - ordered steps on one connected spine. */
function Diagram({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const nodes = brief.nodes ?? [];
  if (nodes.length === 0) return <Infographic brief={brief} t={t} />;
  const size = nodeSize(nodes.length);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <AccentRule t={t} />
        <Headline text={brief.headline} t={t} />
        <Subhead text={brief.subheadline ?? ""} t={t} />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {nodes.map((n, i) => {
          const last = i === nodes.length - 1;
          return (
            <div key={n} style={{ display: "flex", flexDirection: "row", alignItems: "stretch" }}>
              {/* The spine: marker, then a connector that stretches to the next row. */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 84 }}>
                <div
                  style={{
                    display: "flex",
                    width: 66,
                    height: 66,
                    borderRadius: 999,
                    backgroundColor: t.accent,
                    color: t.onAccent,
                    fontSize: 32,
                    fontWeight: 800,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                {!last && (
                  <div style={{ display: "flex", width: 5, flexGrow: 1, backgroundColor: t.border }} />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  paddingBottom: last ? 0 : 26,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    backgroundColor: t.surface,
                    border: `2px solid ${t.border}`,
                    borderRadius: 22,
                    paddingTop: 20,
                    paddingBottom: 20,
                    paddingLeft: 28,
                    paddingRight: 28,
                    fontSize: size,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  {n}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CardChips cards={brief.cards ?? []} t={t} />
    </>
  );
}

/** myth-vs-fact, before-after - two panels, the right one carrying the accent. */
function Comparison({
  brief,
  t,
  category,
}: {
  brief: DesignBrief;
  t: ImageTheme;
  category: ImageCategory;
}) {
  const nodes = brief.nodes ?? [];
  const isMyth = category.id === "myth-vs-fact";
  const leftLabel = isMyth ? "MYTH" : "BEFORE";
  const rightLabel = isMyth ? "FACT" : "AFTER";

  // Even-index nodes argue the left side, odd-index the right. With the usual two
  // nodes that is exactly one line each, and more nodes stack without breaking.
  const left = nodes.filter((_, i) => i % 2 === 0);
  const right = nodes.filter((_, i) => i % 2 === 1);
  const body = (brief.bodyText ?? "").trim();

  const Panel = ({
    label,
    items,
    accent,
  }: {
    label: string;
    items: string[];
    accent: boolean;
  }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexBasis: 0,
        gap: 22,
        backgroundColor: t.surface,
        border: `3px solid ${accent ? t.accent : t.border}`,
        borderRadius: 30,
        padding: 34,
      }}
    >
      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 22,
          paddingRight: 22,
          borderRadius: 999,
          backgroundColor: accent ? t.accent : t.bgAlt,
          color: accent ? t.onAccent : t.textMuted,
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: "flex",
              fontSize: items.length > 2 ? 32 : 38,
              fontWeight: 600,
              lineHeight: 1.25,
              color: accent ? t.text : t.textMuted,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccentRule t={t} />
        <Headline text={brief.headline} t={t} />
        <Subhead text={brief.subheadline ?? ""} t={t} />
      </div>

      <div style={{ display: "flex", flexDirection: "row", gap: 24, alignItems: "stretch" }}>
        <Panel label={leftLabel} items={left} accent={false} />
        <Panel label={rightLabel} items={right} accent />
      </div>

      {body ? (
        <div style={{ display: "flex", fontSize: 32, fontWeight: 400, lineHeight: 1.3, color: t.textMuted }}>
          {body}
        </div>
      ) : (
        <CardChips cards={brief.cards ?? []} t={t} />
      )}
    </>
  );
}

/** big-stat-hero - one dominant figure. */
function StatHero({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const hero = (brief.bodyText || brief.headline).trim();
  const showHeadline = hero !== brief.headline.trim();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 34,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: heroSize(hero),
          fontWeight: 800,
          letterSpacing: -6,
          lineHeight: 1,
          color: t.accent,
          textAlign: "center",
        }}
      >
        {hero}
      </div>
      {showHeadline && <Headline text={brief.headline} t={t} align="center" />}
      <Subhead text={brief.subheadline ?? ""} t={t} align="center" />
      <CardChips cards={brief.cards ?? []} t={t} />
    </div>
  );
}

/** quote-card - the words are the design. */
function QuoteCard({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const quote = (brief.bodyText || brief.headline).trim();
  const attribution = (brief.subheadline ?? "").trim();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 0.7, color: t.accent }}>
        &ldquo;
      </div>
      <div
        style={{
          display: "flex",
          fontSize: heroSize(quote),
          fontWeight: 800,
          lineHeight: 1.14,
          letterSpacing: -2,
          color: t.text,
        }}
      >
        {quote}
      </div>
      {attribution && (
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", width: 72, height: 6, borderRadius: 999, backgroundColor: t.accent }} />
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: t.textMuted }}>
            {attribution}
          </div>
        </div>
      )}
    </div>
  );
}

/** checklist-card - save-bait. The nodes ARE the checklist. */
function Checklist({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const items = brief.nodes ?? [];
  if (items.length === 0) return <Infographic brief={brief} t={t} />;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AccentRule t={t} />
        <Headline text={brief.headline} t={t} />
        <Subhead text={brief.subheadline ?? ""} t={t} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {items.map((item) => (
          <div key={item} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 26 }}>
            <div
              style={{
                display: "flex",
                width: 58,
                height: 58,
                borderRadius: 16,
                backgroundColor: t.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Tick t={t} />
            </div>
            <div
              style={{
                display: "flex",
                fontSize: nodeSize(items.length) + 2,
                fontWeight: 600,
                color: t.text,
              }}
            >
              {item}
            </div>
          </div>
        ))}
      </div>

      <CardChips cards={brief.cards ?? []} t={t} />
    </>
  );
}

/** x-screenshot - a believable social card, built rather than imagined. */
function SocialCard({
  brief,
  t,
  author,
}: {
  brief: DesignBrief;
  t: ImageTheme;
  author?: { name?: string | null; headline?: string | null };
}) {
  const name = (author?.name || "").trim() || "Your Name";
  const sub = (author?.headline || "").trim();
  const body = (brief.bodyText || brief.headline).trim();
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "YN";

  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 34,
          backgroundColor: t.surface,
          border: `2px solid ${t.border}`,
          borderRadius: 36,
          padding: 46,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              width: 92,
              height: 92,
              borderRadius: 999,
              backgroundColor: t.accent,
              color: t.onAccent,
              fontSize: 38,
              fontWeight: 800,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: t.text }}>{name}</div>
            {sub && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 400, color: t.textMuted }}>
                {sub.slice(0, 54)}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: body.length > 110 ? 40 : 50,
            fontWeight: 600,
            lineHeight: 1.26,
            color: t.text,
          }}
        >
          {body}
        </div>

        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", flexGrow: 1, height: 2, backgroundColor: t.border }} />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 400, color: t.textMuted }}>
            {brief.subheadline?.trim() || "Post"}
          </div>
        </div>
      </div>
    </div>
  );
}

/** event-banner, announcement-card - one centred, confident statement. */
function Banner({ brief, t }: { brief: DesignBrief; t: ImageTheme }) {
  const cta = (brief.cards ?? [])[0] || (brief.nodes ?? [])[0] || "";
  const detail = (brief.nodes ?? []).filter((n) => n !== cta);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 38,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <AccentRule t={t} />
      </div>
      <Headline text={brief.headline} t={t} align="center" />
      <Subhead text={brief.subheadline ?? ""} t={t} align="center" />

      {detail.length > 0 && (
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {detail.map((d) => (
            <div
              key={d}
              style={{
                display: "flex",
                paddingTop: 14,
                paddingBottom: 14,
                paddingLeft: 28,
                paddingRight: 28,
                borderRadius: 999,
                border: `2px solid ${t.border}`,
                backgroundColor: t.surface,
                color: t.text,
                fontSize: 29,
                fontWeight: 600,
              }}
            >
              {d}
            </div>
          ))}
        </div>
      )}

      {cta && (
        <div
          style={{
            display: "flex",
            paddingTop: 24,
            paddingBottom: 24,
            paddingLeft: 52,
            paddingRight: 52,
            borderRadius: 999,
            backgroundColor: t.accent,
            color: t.onAccent,
            fontSize: 36,
            fontWeight: 800,
          }}
        >
          {cta}
        </div>
      )}
    </div>
  );
}

// ─── Dispatch + render ───────────────────────────────────────────────────────

function Layout({ category, brief, t, author }: RenderOptions & { t: ImageTheme }) {
  switch (category.genApproach) {
    case "diagram":
      return <Diagram brief={brief} t={t} />;
    case "comparison":
      return <Comparison brief={brief} t={t} category={category} />;
    case "banner":
      return <Banner brief={brief} t={t} />;
    case "text-card":
      // The four text-card categories want genuinely different shapes, so they
      // branch on id rather than sharing one generic card.
      if (category.id === "big-stat-hero") return <StatHero brief={brief} t={t} />;
      if (category.id === "quote-card") return <QuoteCard brief={brief} t={t} />;
      if (category.id === "x-screenshot") return <SocialCard brief={brief} t={t} author={author} />;
      return <Checklist brief={brief} t={t} />;
    case "designed-infographic":
    case "carousel-hint":
    default:
      return <Infographic brief={brief} t={t} />;
  }
}

/**
 * Render one designed post image to a PNG buffer.
 *
 * Deterministic for a given brief: the same input always produces the same image,
 * which is what makes a carousel look like one set.
 */
export async function renderDesignedImage(opts: RenderOptions): Promise<Buffer> {
  const t = resolveTheme(opts.brief.themeId, opts.seed);

  // Layouts that centre their own content manage the whole column; the rest get
  // headline-at-top with the body spaced beneath.
  //
  // The last clause matters for carousels: the plan deliberately gives the hook
  // and takeaway slides no labels, and a lone headline pinned to the top of an
  // otherwise empty slide reads as a mistake. With nothing to space against,
  // centring turns it into a deliberate statement slide instead.
  const hasBody = (opts.brief.nodes?.length ?? 0) > 0 || (opts.brief.cards?.length ?? 0) > 0;
  const centred =
    opts.category.genApproach === "banner" ||
    (opts.category.genApproach === "text-card" && opts.category.id !== "checklist-card") ||
    !hasBody;

  // Reserve a strip at the bottom when the carousel indicator is present, so it
  // never collides with the layout's own content.
  const dotStrip = opts.slide ? 52 : 0;

  const svg = await satori(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          // Full-bleed by construction: the background IS the root element, so
          // there is no frame, keyline or inset panel to accidentally draw.
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          backgroundColor: t.bg,
          fontFamily: FONT_FAMILY,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // Satori follows the CSS default of content-box, NOT border-box.
            // Sizing the content box explicitly and spacing it with a margin is
            // what keeps the layout inside the frame - with `width: 100%` plus
            // padding, the content box was the full 1080 and the padding was
            // added OUTSIDE it, so every child was laid out 152px too wide and
            // the right edge of each card was clipped off.
            width: IMAGE_SIZE - PAD * 2,
            height: IMAGE_SIZE - PAD * 2 - dotStrip,
            margin: PAD,
            justifyContent: centred ? "center" : "space-between",
          }}
        >
          <Layout {...opts} t={t} />
        </div>

        {/* Pinned to the frame, not to the content: a centred layout would
            otherwise pull the indicator up next to the headline. */}
        {opts.slide && (
          <div
            style={{
              position: "absolute",
              bottom: PAD * 0.7,
              left: 0,
              width: IMAGE_SIZE,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <SlideDots slide={opts.slide} t={t} />
          </div>
        )}
      </div>
    ),
    {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      fonts: getRenderFonts(),
      // Glyphs become <path> data, so the SVG below needs no font support from
      // the rasteriser and renders identically on every platform.
      embedFont: true,
    }
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
