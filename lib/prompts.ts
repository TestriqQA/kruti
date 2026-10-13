import type { ImageCategory } from "@/lib/image-categories";

// ─── Writing Rules ────────────────────────────────────────────────────────────

const NO_EMOJI_RULES = `
CRITICAL WRITING RULES - FOLLOW WITHOUT EXCEPTION:
- Do NOT use emojis of any kind
- Do NOT use special Unicode characters, bullet symbols, or decorative symbols
- Write like a real human professional, not an AI assistant
- Avoid corporate buzzwords: leverage, synergy, pivot, game-changer, rockstar, disruptive, ecosystem, holistic
- Use natural sentence structure with occasional sentence fragments for authenticity
- Vary paragraph length - mix short punchy sentences with longer explanatory ones
- Do not start multiple consecutive sentences with "I"
- Sound conversational and direct
`.trim();

const HUMAN_MODE_RULES = `
HUMAN MODE ACTIVE - ADDITIONAL AUTHENTICITY RULES:
- Use contractions liberally: don't, won't, can't, I've, it's, they're, we're
- Occasionally start a sentence with "And" or "But" for natural flow
- Include one or two subtly informal phrases per post: "honestly", "here's the thing", "look,", "real talk"
- Vary your punctuation naturally - not every sentence needs to be perfectly structured
- Write with the energy of someone who typed this on their laptop between meetings
- Do NOT add deliberate misspellings - just natural human writing rhythm
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRules(humanMode: boolean): string {
  return humanMode
    ? `${NO_EMOJI_RULES}\n\n${HUMAN_MODE_RULES}`
    : NO_EMOJI_RULES;
}

// ─── Visual Profile (for image personalization) ──────────────────────────────

export interface UserVisualProfile {
  positioning?: string | null;
  contentStyles?: string | null;
  industry?: string | null;
  name?: string | null;
  headline?: string | null; // the person's actual ROLE (e.g. "SEO Analyst") - drives the imagery
}

/**
 * Derives a single, concrete role-grounding line for image prompts. Deliberately
 * does NOT pre-commit a visual register or composition style - that would fight the
 * per-post "style varies by content" selection the art director makes. It only
 * anchors the imagery to the person's actual ROLE (their headline/title) so it draws
 * on what they really do, never a generic industry stereotype - an SEO analyst and a
 * backend engineer, both in "technology", get different imagery.
 */
export function deriveVisualStyle(profile: UserVisualProfile): string {
  const role = (profile.headline || "").trim();
  if (role) {
    return `Ground the imagery in the real tools, screens, artifacts, environments, and day-to-day moments of THIS person's actual role - "${role}" - not a generic stereotype of their field (for example, no circuit boards, chips, or wires just because the field is technology). Show what this specific role genuinely works with.`;
  }
  return "";
}

export const ALL_POST_TYPES = ["thought-leadership", "tips", "story", "question", "listicle"];

// Explicit map: each onboarding content style -> the post type(s) it should
// produce. Keys are lowercased for case-insensitive matching against the stored
// style labels. This is the ONLY source of which post types are allowed, so the
// user's onboarding selection is respected strictly - no extra types are added.
const STYLE_TO_POST_TYPES: Record<string, string[]> = {
  "problem agitation solution": ["tips"],
  "narrative / story": ["story"],
  "list / tips": ["listicle", "tips"],
  "data-driven insights": ["listicle"],
  "personal story": ["story"],
  "case study": ["listicle"],
  "how-to / tutorial": ["tips"],
  "motivational": ["thought-leadership"],
  "contrarian take": ["thought-leadership"],
  "q&a format": ["question"],
  "behind the scenes": ["story"],
  "predictions & trends": ["thought-leadership"],
  "lessons learned": ["story"],
  "social proof / results": ["listicle"],
};

// One concrete writing directive per onboarding content style. This is what makes
// the user's ACTUAL selection drive each post: instead of flattening 14 styles into
// 5 coarse post types, each post is written genuinely in the style the user picked.
// Keys are lowercased to match the stored style labels case-insensitively.
export const STYLE_DIRECTIVES: Record<string, string> = {
  "behind the scenes": "Take the reader inside a real process - show the messy middle, the decision, the trade-off, not a polished result. Do NOT open with a statistic.",
  "contrarian take": "Challenge a widely held belief in this field; lead with the counter-position and defend it. Open with the claim, not a number.",
  "personal story": "Tell one specific first-person moment with a turn and a lesson. Open with the scene, not a number.",
  "narrative / story": "Use a narrative arc - setup, tension, resolution - anchored in a concrete situation. Open with the scene, not a number.",
  "lessons learned": "Frame around a mistake or hard-won lesson and the principle it taught. Open with the moment, not a number.",
  "data-driven insights": "Build the post around ONE notable figure from the brief and the practitioner 'so what' behind it. A number here is appropriate.",
  "case study": "Walk through one real situation: problem, what was done, outcome. A specific result is fine but the story carries it.",
  "social proof / results": "Center a concrete result or outcome and what made it possible. A result figure is fine; do not stack multiple stats.",
  "how-to / tutorial": "Give a clear, ordered, do-this-next set of steps the reader can act on today.",
  "problem agitation solution": "Name the painful problem sharply, sit in it briefly, then deliver a concrete fix.",
  "motivational": "Land one earned, specific point of conviction grounded in real practice - no platitudes, no inspirational filler.",
  "predictions & trends": "Make one defensible forward-looking claim about where this field is heading and why.",
  "q&a format": "Pose one real question this audience actually asks, then answer it with practitioner depth.",
  "list / tips": "Give a tight numbered set of genuinely useful, non-obvious tips.",
};

/**
 * Returns the user's literal selected style labels (order preserved), e.g.
 * ["Contrarian Take", "Behind the Scenes"]. Safe against null and malformed JSON.
 */
export function parseSelectedStyles(contentStylesStr: string | null | undefined): string[] {
  if (!contentStylesStr) return [];
  try {
    const v = JSON.parse(contentStylesStr);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The single source of truth for which style each post in a batch is written in.
 * Cycles the user's literal selected styles round-robin (falling back to the coarse
 * post types only when no styles are stored). buildPostsPrompt uses this to build the
 * per-post plan, and the posts route uses the SAME assignment to persist each post's
 * style - so the badge shown to the user matches the style the post was written in.
 */
export function assignPostStyles(
  selectedStyles: string[],
  postTypes: string[],
  postCount: number
): string[] {
  const rotation = selectedStyles.length > 0 ? selectedStyles : postTypes;
  return Array.from({ length: postCount }, (_, i) =>
    rotation.length > 0 ? rotation[i % rotation.length] : "thought-leadership"
  );
}

/**
 * Map the user's selected onboarding content styles to the LinkedIn post types
 * that may be generated. Returns ONLY the types for the styles the user actually
 * selected (deduplicated) - nothing extra is ever added. If no styles are stored
 * or none are recognized, falls back to all types as a safe default.
 */
export function deriveAllowedPostTypes(contentStylesStr: string | null | undefined): string[] {
  if (!contentStylesStr) return ALL_POST_TYPES;

  let styles: unknown;
  try {
    styles = JSON.parse(contentStylesStr);
  } catch {
    return ALL_POST_TYPES;
  }
  if (!Array.isArray(styles) || styles.length === 0) return ALL_POST_TYPES;

  const allowed = new Set<string>();
  for (const style of styles) {
    const types = STYLE_TO_POST_TYPES[String(style).trim().toLowerCase()];
    if (types) types.forEach((t) => allowed.add(t));
  }

  // Only fall back to the full set if nothing mapped (e.g. unrecognized labels),
  // so we never end up with zero allowed types.
  return allowed.size > 0 ? Array.from(allowed) : ALL_POST_TYPES;
}

// ─── Strategy Prompt ─────────────────────────────────────────────────────────

export interface PreviousWeekSummary {
  weekStart: string;
  weekTheme: string;
  weekFocus: string;
  postTitles: string[];
  postTypes: string[];
}

export function buildStrategyPrompt(
  profileContext: string,
  weekStart: Date,
  previousWeeks: PreviousWeekSummary[] = [],
  allowedTypes: string[] = ["thought-leadership", "tips", "story", "question", "listicle"]
): string {
  const weekLabel = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let previousContext = "";
  if (previousWeeks.length > 0) {
    previousContext = `
PREVIOUS WEEKS CONTENT HISTORY (most recent first):
${previousWeeks
  .map(
    (w, i) => `
Week ${i + 1} - ${w.weekStart}:
  Theme: "${w.weekTheme}"
  Focus: "${w.weekFocus}"
  Posts: ${w.postTitles.map((t) => `"${t}"`).join(", ")}
  Types used: ${w.postTypes.join(", ")}`
  )
  .join("\n")}

CONTINUITY RULES (read the history above carefully before deciding this week):
- Same overarching journey, new chapter: the weekTheme and weekFocus must be a topic not yet covered and clearly DIFFERENT from every previous week listed (not a reworded version of one already used), but they should advance the same audience relationship rather than reset it.
- Treat the weeks above as one ongoing arc. This week should read like the natural next chapter, deepening the audience's understanding.
- Pick a fresh angle, sub-topic, or stage of the journey within this person's expertise that the previous weeks have not yet covered.
- Look at the post types already used. If recent weeks leaned heavily on one or two types, deliberately rebalance the mix this week so the feed does not feel repetitive.
- It is good to occasionally reference or build on an idea from a previous week, but never to repeat it.
`;
  }

  return `You are one of the most sought-after LinkedIn content strategists in the world. Founders and senior operators pay you to turn their raw expertise into a weekly content plan that builds genuine authority and pipeline. You do not produce generic "post 3x a week about your industry" advice. Every plan you build is engineered around the specific human in front of you - their positioning, their goals, the exact pains their audience feels, and the voice they actually speak in.

Your task: design a sharp, personalized content strategy for the next 5 weekdays starting ${weekLabel}, built end to end around THIS person.

PROFESSIONAL PROFILE:
${profileContext}
${previousContext}
BEFORE WRITING (think through these, but output ONLY the final JSON - never print your reasoning):
1. Positioning first. Read the Content positioning, Headline, Summary and Skills. The whole week must reinforce how this person wants to be seen (for example a Thought Leader earns a point-of-view-led plan, an Industry Expert earns a credibility-and-proof-led plan). Do not drift into generic motivation.
2. Anchor to goals. Tie weekTheme, weeklyGoal and callToAction directly to this person's stated LinkedIn goals. The week should visibly move them toward those goals, not just "get engagement".
3. Audience pain over topic dumps. Identify the real, specific problems and desired outcomes of the stated target audience - the things that keep them up at night and the wins they want. Every pillar must map to a real pain or aspiration of THIS audience, expressed in concrete language, never vague filler like "stay relevant" or "grow your career".
4. Lean on their actual expertise. The pillars must draw on the person's specific Skills, Industry and experience so the week can only have been planned for them - someone in a different field could not reuse it.
5. Voice and tone are non-negotiable. The tone block must reflect this person's real voice. Honor the VOICE AND TONE direction stated in the profile above, and reconcile it with the Content positioning. The tone.voice and tone.style you set will steer every post that gets written this week, so make them specific and true to this person, not a generic "professional and engaging".
6. Make the week cohesive. The pillars, post mix and theme should feel like one intentional arc for the week, not five unrelated topics. The weekFocus is the through-line that connects them.
7. Choose post types from the allowed set only, weighting them toward what best serves this person's positioning and this week's focus.

QUALITY BAR:
- Specific over generic. Anything you write here could only fit THIS person and THIS audience. If a line would fit any random professional, rewrite it.
- Concrete pains and outcomes, in the audience's own words.
- A point of view, not a syllabus. The week should take a stance worth following.
- No fabrication: do not invent credentials, employers, results, or numbers that are not implied by the profile. Set direction here; the actual facts and stats come later from research.

${NO_EMOJI_RULES}

Generate the content strategy as a JSON object with this EXACT structure:
{
  "weekTheme": "string (the overarching theme for the week, tied to this person's positioning and goals - must be DIFFERENT from any previous week)",
  "weekFocus": "string (the specific angle or narrative arc that connects the week - a FRESH perspective, not a reworded previous focus)",
  "pillars": [
    {
      "name": "string (content pillar name, grounded in this person's expertise)",
      "description": "string (what this pillar covers and which specific audience pain or desired outcome it serves)",
      "percentage": number (percent of posts for this pillar, all pillar percentages must sum to 100)
    }
  ],
  "audience": {
    "primaryAudience": "string (the specific target audience for this week)",
    "painPoints": ["string (a real, concrete problem this audience faces)"],
    "desiredOutcomes": ["string (a specific outcome this audience wants)"]
  },
  "tone": {
    "voice": "string (this person's actual voice, reflecting their positioning and the profile's stated tone, e.g. 'Direct and confident, with hard-won practitioner credibility')",
    "style": "string (how the posts should read in practice, e.g. 'Plain-spoken, example-led, one strong idea per post')",
    "avoid": ["string (specific things to avoid that would break this person's voice or credibility)"]
  },
  "postTypes": ${JSON.stringify(allowedTypes)},
  "postMix": {
    ${allowedTypes.map((t) => `"${t}": number`).join(",\n    ")}
  },
  "weeklyGoal": "string (what success looks like this week, tied directly to this person's LinkedIn goals)",
  "callToAction": "string (the primary call-to-action to carry through the week, serving the weekly goal)"
}

For "postMix": each value is a percentage (0-100), and all postMix values must sum to 100. Use the exact string keys shown.

All string values must be single-line plain text with no double-quote characters inside them. Do not include trailing commas. The output must parse with JSON.parse.

Return ONLY valid JSON. No markdown fences. No explanation. No emojis.`;
}

// ─── Posts Prompt ────────────────────────────────────────────────────────────

export function buildPostsPrompt(
  profileContext: string,
  weekTheme: string,
  weekFocus: string,
  postTypes: string[],
  strategy: object,
  humanMode: boolean = true,
  postCount: number = 5,
  allowedTypes: string[] = ["thought-leadership", "tips", "story", "question", "listicle"],
  researchBrief: string = "",
  selectedStyles: string[] = [],
  imageStyleGuide: string = "",
  imageStyleIds: string = "infographic"
): string {
  const rules = getRules(humanMode);

  // Per-post style plan: assign each post a distinct style the user actually chose
  // (e.g. "Behind the Scenes", "Contrarian Take") so the batch reads as different
  // shapes, not one repeated post type. Uses the shared assignPostStyles so the saved
  // post.style (set in the route) matches what the writer was told for each post.
  const perPostStyles = assignPostStyles(selectedStyles, postTypes, postCount);
  const perPostPlan = perPostStyles
    .map((style, i) => {
      const directive = STYLE_DIRECTIVES[String(style).trim().toLowerCase()] ?? "";
      return `Post ${i + 1} - STYLE: ${style}${directive ? ` - ${directive}` : ""}`;
    })
    .join("\n");

  const researchBlock = researchBrief.trim()
    ? `RESEARCH BRIEF (real, current, verified facts gathered for this batch - your source of truth):
${researchBrief.trim()}

HOW TO USE THE RESEARCH BRIEF:
- Ground the posts in the specific facts, mechanisms, examples, and expert interpretation above. Most posts should make their point qualitatively; reach for a number only when it is genuinely the sharpest way to make THIS post's point. What separates an expert post from filler is sharp insight and concrete detail, not the presence of a statistic.
- Use stats and facts only as they appear in the brief. Do NOT round, inflate, reshape, or "improve" any number.
- Do NOT invent statistics, studies, dates, company names, or quotes that are not in the brief. If you want to make a point the brief does not support with a number, make it qualitatively instead - never with a fabricated figure.
- If a heading in the brief says no reliable current data was found, treat that area as having no usable numbers and make the point qualitatively.
- You do not need to cram every fact in. Pick the few most relevant, surprising, or useful points for this person's audience and build real insight around them.
- Add this person's own expert interpretation on top of the facts - the "so what" and "what to do about it" that only a practitioner in their field would know.
- Do not name a specific source or report unless the brief names it. When you reference a finding, paraphrase it in plain language (for example, research from last year found...) rather than inventing a precise citation string.`
    : `NO RESEARCH BRIEF WAS PROVIDED FOR THIS BATCH:
- Write from genuine, specific domain expertise in this person's field.
- Because there is no brief this batch, do not present ANY statistic, percentage, study, or dated claim as sourced. Speak from mechanism, real-world scenarios, and lived practitioner detail only.
- Do NOT fabricate statistics, studies, percentages, dates, or named sources to sound authoritative. If you cannot cite a real figure, make the point qualitatively with concrete, hard-won detail instead.`;

  return `You are a world-class LinkedIn ghostwriter writing AS the specific person described in the profile below. You are not a generic AI assistant - you are this person's voice. Every post must read like a sharp, credible human expert in their field wrote it in their own tone, for the exact audience they care about. Create ${postCount} original, genuinely valuable LinkedIn posts for their scheduled posting days.

PROFESSIONAL PROFILE (write in THIS person's voice, tone, and positioning - match their tone preferences exactly):
${profileContext}

THEME: "${weekTheme}"
FOCUS: "${weekFocus}"

PER-POST STYLE PLAN (write each post genuinely in its assigned style - the ${postCount} posts must read as clearly DIFFERENT shapes, not the same template with different words):
${perPostPlan}

UNIQUENESS (strict): every one of the ${postCount} posts must be completely UNIQUE - a different title and hook, a different core idea and angle, and a different structure. No two posts may share the same topic, opening line, or takeaway; each post's title and content must clearly stand on its own.

Use the tone.voice, tone.style and tone.avoid fields from the strategy below as hard constraints on how this week's posts read - the avoid list names things you must NOT do.
STRATEGY CONTEXT: ${JSON.stringify(strategy)}

${researchBlock}

WHAT MAKES THESE POSTS EXPERT-LEVEL (this is the whole point - do not skip):
- Voice: Write exactly as this person would speak - their tone, their level of formality, their personality from the profile. If the profile specifies tone preferences (professional, conversational, inspirational, educational), honor them precisely. A reader who knows this person should recognize them in the writing.
- Audience-first: Every post must give the target audience something real - a sharper way to think about a problem they have, a concrete tactic, a non-obvious insight, or a useful reframe. Never write to impress; write to be useful.
- Specificity over fluff: Use concrete details, real situations, named tools or methods, and - only where it genuinely sharpens the point - a relevant figure from the brief, and precise language. Replace every vague generality ("companies are struggling", "AI is changing everything") with a specific, grounded claim.
- One idea per post: Each post makes ONE clear point and earns it. No grab-bag of disconnected thoughts.
- Hook: The first line (title) must make the second line unavoidable. Choose an opener that fits THIS post's assigned style - a concrete scene, a blunt defensible claim, a confession, a contrarian assertion, a specific moment in time, or a question reframed as a statement. At most ONE post in this whole batch may open with a statistic, and only when a number is genuinely the sharpest opener for its assigned style; every other post must open a different way. Banned openers: "In today's [x] world", "Let that sink in", "Read that again", "Most people get this wrong", "Unpopular opinion", "I'll be honest", and any standalone rhetorical question.
- Vary the opening device across the ${postCount} posts. Never reuse the same stock phrase ("here's the thing", "real talk", "let's be honest") more than once in the whole batch.
- Real CTA: End by asking about the reader's own experience with the specific thing this post covered, or by giving them one concrete thing to try. Banned CTAs: "What's your take", "Curious to hear your thoughts", "Agree?", "Comment below", "Let me know your thoughts", "Drop a comment". A good CTA could not be pasted onto a different post.
- No motivational filler: Cut platitudes, inspirational-poster lines, and empty positivity. If a sentence would survive on any post in any industry, rewrite it to be specific to this person and topic.

${rules}

IMAGE CATEGORY (pick the best-fit visual FORMAT for each post from its OWN content):
${imageStyleGuide}
Choose the "imageStyle" id that best matches THIS post's content and tone - a meme for a relatable or funny take, a quote-card for one punchy line, before-after for a teardown, framework-diagram or timeline-roadmap for a model or sequence, big-stat-hero ONLY when the post has a real stat, and realistic-scene / behind-the-scenes / desk-setup / storytelling-scene for human or story posts (these render a tasteful REPRESENTATIVE scene, never a fabricated portrait). SPREAD the choice across the ${postCount} posts. The three groups - Relatable & Human, Educational & Authority, Branded & Quick-Hit - must ALL appear in a batch of ${postCount}, and at least one post must use a Relatable & Human format (a meme or a real scene) unless literally none of the posts is a story, an opinion or a human moment. Never give two posts in the batch the same imageStyle unless their content genuinely calls for the same shape, and never fall back to "infographic" as a default - pick it only when the post really is an explainer with several parts to lay out.

Generate exactly ${postCount} posts as a JSON array. Each post must follow this exact structure:
[
  {
    "title": "string (scroll-stopping hook - the opening line of the post, specific and concrete, max 150 chars)",
    "body": "string (full post body, max 1300 characters, one clear idea, grounded in real specifics)",
    "hashtags": ["string", "string", "string", "string", "string"],
    "postType": "${allowedTypes.join("|")}",
    "imageStyle": "${imageStyleIds}",
    "imagePrompt": "string (a short 1-2 sentence visual concept - describe the SCENE or METAPHOR, not text to display. Example: 'A lighthouse beam cutting through fog at dawn, symbolizing guidance' NOT 'An image showing the words Leadership Matters')",
    "bestTimeToPost": "string (e.g. Tuesday 9am)",
    "callToAction": "string (the specific, natural CTA embedded in this post)"
  }
]

Rules for each post:
- Each post must sound like it was written by the specific person in the profile above, in their tone and voice - not by an AI.
- Build each post on real, specific substance: facts and examples from the research brief where one is provided, plus this person's expert interpretation. Never use a stat or source that is not in the brief.
- If you quote any phrase from the research brief inside a post, paraphrase it - never reproduce double-quote characters inside any JSON string value.
- Vary the format: some with short paragraphs, some with numbered points, some as narrative. Write each post genuinely in the style assigned to it in the per-post style plan above, so the batch reads as different shapes.
- Include a strong, specific, natural call-to-action in each post body - not generic engagement bait.
- Do not use bullet points starting with dashes - use numbered lists or plain paragraphs.
- Hashtags must be relevant, lowercase, no spaces (e.g. productmanagement, leadership).
- Image prompts must describe a scene or visual metaphor only - NEVER describe text or words that should appear in the image.
- Choose "imageStyle" by matching THIS post's content and tone to the image category list above; vary it across the batch where content genuinely differs.

All string values must be single-line plain text with no double-quote characters inside them. In the "body" field, emit any line breaks as escaped \\n, not as raw newlines. Do not include trailing commas. The output must parse with JSON.parse.

Return ONLY the JSON array. No markdown. No explanation. No emojis.`;
}

// ─── Research Brief Prompt (Google Search grounding) ──────────────────────────
// One call per batch, sent to gemini-2.5-flash WITH the Google Search grounding
// tool enabled (use generateGroundedText, NOT generateText). Returns FREE-FORM
// TEXT (not JSON) - do NOT route this through parseJSON. The resulting brief is
// passed into buildPostsPrompt so the writer is grounded in real, current facts.

export function buildResearchPrompt(
  weekTheme: string,
  weekFocus: string,
  pillars: object[],
  industry: string,
  targetAudience: string,
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const pillarLines = (pillars as Array<{ name?: string; description?: string }>)
    .map((p) => `- ${p?.name ?? "Pillar"}: ${p?.description ?? ""}`.trim())
    .join("\n");

  return `You are a sharp research analyst preparing a fact-pack for an expert LinkedIn writer in the ${industry || "business"} field. Use Google Search to research the topic on the live web, then write a concise RESEARCH BRIEF the writer will use to ground a week of posts in real, current, credible information.

Today's date is ${today}. "Recent" and "current" mean within roughly 18 months of this date. Do not present older information as current.

WHAT THE WRITER IS COVERING THIS WEEK
Industry: ${industry || "Not specified"}
Target audience: ${targetAudience || "professionals in this industry"}
Week theme: "${weekTheme}"
Week focus / angle: "${weekFocus}"
Content pillars:
${pillarLines || "- (none specified)"}

YOUR JOB
Search the web now for the most relevant, recent, and credible information on this theme, focus, and pillars as they relate to the ${industry || "business"} field and to ${targetAudience || "this audience"}. Then synthesize what you find into a tight brief.

Organize the brief under these headings (use these exact plain-text headings, no markdown styling needed):

KEY FACTS
- The most important, currently-true facts a knowledgeable expert in this field would cite. Concrete and specific, not generic.

EXPERT TALKING POINTS
- 4 to 8 sharp, non-obvious angles, contrarian takes, or "what most people miss" insights an expert in this field would actually voice on this theme. These are the spine of strong posts.

CONCRETE EXAMPLES
- Real-world examples, named companies, products, people, case studies, or scenarios that the writer can reference specifically (not invented or hypothetical).

COMMON MISCONCEPTIONS
- Widely-believed but wrong or oversimplified ideas in this area that an expert could correct to sound credible.

RECENT DEVELOPMENTS
- News, launches, regulatory or market shifts, or notable events from roughly the last 18 months that are relevant to the theme. Include the rough timing of each.

STATISTICS AND DATA (optional - include at most 2 or 3, and only if a genuinely notable, well-sourced figure exists; otherwise skip this section entirely)
- Real numbers, percentages, survey results, or benchmarks you found via search. After each, add a rough date or time frame in parentheses (for example "(2024 report)", "(as of early 2025)") and name the source or type of source. Only include numbers you actually found in search results. If you cannot find a credible figure for a point, leave the number out rather than estimating.

STRICT RULES
- Only include facts, numbers, examples, and developments you actually found through search. Do NOT fabricate, estimate, or fill gaps from general knowledge. It is better to write less than to invent anything.
- Every statistic must have a rough date or time frame and a named source or source type. If you are not confident a figure is real and current, omit it.
- If search returns little credible material for a heading, write "No reliable current data found" under that heading rather than filling it from general knowledge.
- Keep the entire brief under 350 words. Favor the 8 to 12 most usable, specific, recent facts over completeness. This is a working fact-pack for a writer, not an essay. No introduction, no conclusion, no filler, no sales language.
- Stay tightly relevant to the theme, focus, pillars, industry, and audience above. Discard anything tangential.
- Write in plain text. Use plain hyphens, never em-dashes or en-dashes. Do not use emojis.

Output ONLY the research brief under the headings above. Do not add commentary before or after it.`;
}

// ─── Single Image Brief Prompt ────────────────────────────────────────────────
// Reads a post and briefs ONE premium, designed marketing INFOGRAPHIC that explains
// the post at a glance (structure + icons + organized labels + a prominent headline).
// Returns JSON: { style, structure, headline, subheadline, visual, nodes, cards, palette }.

/**
 * Brief for a CODE-RENDERED designed image (lib/render-card.tsx).
 *
 * Deliberately a fraction of the size of buildImageBriefPrompt's designed
 * branch, which this replaces for every non-photographic format.
 *
 * That old prompt spent roughly ninety lines briefing an art director: the
 * aesthetic register, a named information-design structure, an art-director
 * paragraph describing icons and connectors, and a prose palette ("a dark ink
 * ground with one bright accent and light text"). All of it existed because a
 * diffusion model has to be *talked* into a layout.
 *
 * Nothing renders from prose any more. The layout comes from the format, the
 * colours come from tokens the model picks by id, and the type scale is CSS. So
 * the only thing left worth asking a language model for is the thing it is
 * actually good at: the WORDS. Everything here is text that will appear on the
 * image verbatim, which also means the model no longer has any way to misspell
 * a label - it is not drawing it.
 *
 * Side effect worth having: the prompt is a few hundred tokens instead of a few
 * thousand, on every single image generation.
 */
export function buildDesignBriefPrompt(
  title: string,
  body: string,
  postType: string,
  category: ImageCategory,
  themeMenu: string,
  themeIds: string,
  iconMenu: string,
  userProfile?: UserVisualProfile
): string {
  const role = userProfile?.headline || "professional";

  return `You are a senior editorial designer writing the TEXT for one square (1:1) LinkedIn graphic. Every string you return is rendered on the image exactly as written - you are not describing a picture, you are writing the words that will appear.

FORMAT: ${category.label} - ${category.briefGuidance}

POST TITLE (hook): ${title}
POST BODY: ${body}
POST TYPE: ${postType}
AUTHOR'S ROLE: ${role}

Read the post, find its single most important point, and write the graphic.

THEME - pick the ONE id whose mood matches this post's subject and tone:
${themeMenu}
Vary this across posts: a blunt contrarian take, a warm personal story, a technical how-to and a celebratory win must not all land on the same theme.

ICONS - every graphic carries real vector icons, so pick the CONCEPT each one should show from exactly this list (one word, copied exactly):
${iconMenu}

Return ONLY this JSON object:
{
  "themeId": "${themeIds}",
  "headline": "string",
  "subheadline": "string",
  "bodyText": "string",
  "nodes": ["string"],
  "icons": ["string"],
  "cards": ["string"],
  "heroIcon": "string",
  "backgroundScene": "string"
}

FIELDS:
- "headline": the graphic's title, stating the post's core point in your own words. 2 to 6 words, at most 34 characters, Title Case. Specific and concrete ("Ads vs SEO", "Where To Start With Python"), never a vague label, and never the post title copied verbatim. No quotation marks, no hashtags.
- "subheadline": ONE supporting line drawn from the post, at most 70 characters, plain sentence case, no ending period. Use "" if the post genuinely needs none.
- "bodyText": the hero words for formats that are built around one piece of text - the quote line for a quote card, the single figure for a big-stat hero, the verbatim key line for a social screenshot. At most 160 characters. Use "" for every other format.
- "nodes": the short labels that make up this format's content - the steps, the stages, the checklist items, or the two sides of a comparison. Each 1 to 4 words, at most 28 characters. Use 3 to 5 for a list, diagram, timeline or checklist; EXACTLY 2 for a comparison (first = the myth or the before, second = the fact or the after); and [] for a quote card, big-stat hero or screenshot. Drawn strictly from the post, never invented, never a full sentence.
- "icons": ONE concept from the icon list for EACH entry in "nodes", in the same order and the same length. Choose on meaning - what is that specific step, side or item actually about? Do not repeat the same concept twice on one graphic unless the content genuinely repeats. Use [] when "nodes" is [].
- "heroIcon": ONE concept from the icon list that represents the post as a whole. Always provide this, every format uses it.
- "backgroundScene": a short art direction for ONE premium, believable, TEXT-FREE photograph that will sit behind this graphic. Describe the subject, the setting, the light and the mood in 15 to 35 words, grounded in what THIS post is actually about and in the author's real working world - not a stock cliche. It must contain NO words, letters, numbers, charts, screens full of UI, logos or signage of any kind, because the text is drawn on top in code. Leave the frame relatively calm and uncluttered so type stays readable over it. Always provide this.
- "cards": 0 to 4 very short supporting chips ("Instant Traffic", "Better ROI"), each 1 to 3 words and at most 22 characters, from the post. Use [] when the post does not call for them. For a banner, the FIRST card is used as the call-to-action button.

RULES:
- Everything must come from the post. Invent no facts, figures, statistics, claims or brand names.
- Spell every word correctly. These strings are rendered as-is, so a typo ships.
- Prefer fewer, larger words over many small ones: if a label needs more than 4 words, cut it down.
- Plain hyphens only, never em-dashes or en-dashes. No emojis. No markdown.
- Single-line plain text in every string, with no double-quote characters inside any value. No trailing commas. The output must parse with JSON.parse.

Return ONLY the JSON. No fences, no explanation.`;
}

/**
 * Plan for a CODE-RENDERED carousel (lib/render-card.tsx).
 *
 * The companion to buildDesignBriefPrompt, and it replaces buildCarouselPlanPrompt
 * for the same reason: every slide of a carousel was already specified as a
 * "designed infographic", so none of them were ever a job for a diffusion model.
 *
 * The old plan prompt was the single most expensive text call in the app - around
 * a hundred lines asking for a shared aesthetic style, a shared prose palette, an
 * information-display pattern, and a per-slide art-director paragraph, all to
 * talk an image model into a layout four separate times.
 *
 * Here the layout is code and the palette is one token id shared by the whole
 * set, which is what actually makes a carousel look like a set. What is left is
 * the part that matters: a real narrative arc, in words, with the hook and the
 * takeaway carrying no labels so they render as statement slides.
 */
export function buildCarouselDesignPrompt(
  title: string,
  body: string,
  postType: string,
  count: number,
  themeMenu: string,
  themeIds: string,
  iconMenu: string,
  userProfile?: UserVisualProfile
): string {
  const role = userProfile?.headline || "professional";

  return `You are a senior editorial designer writing the TEXT for a ${count}-slide square (1:1) LinkedIn carousel. Every string you return is rendered on a slide exactly as written - you are not describing pictures, you are writing the words that appear.

THE POST:
Title (hook): ${title}
Body: ${body}
Post type: ${postType}
Author's role: ${role}

Read the post, then plan the ${count} slides as ONE continuous argument.

SLIDE ARC (follow this order):
- Slide 1 is the HOOK: the post's single most important claim, stated flat and hard. No labels on this slide.
- The middle slides are the post's key points, in the order the body makes them, ONE point per slide, each with its own supporting labels.
- The LAST slide is the TAKEAWAY or call to action that closes the post. No labels on this slide.
Produce EXACTLY ${count} slides. If the post has fewer distinct points than that, split the most important point into a "what" slide and a "how" slide rather than repeating one or padding with invented material.

ONE SHARED THEME for the whole carousel - pick the ONE id whose mood matches this post's subject and tone:
${themeMenu}
Every slide uses this one theme, which is what makes the set cohere. Vary it across different posts: a blunt contrarian take, a warm personal story, a technical how-to and a celebratory win must not all land on the same theme.

ICONS - every slide carries real vector icons, so pick the CONCEPT each one should show from exactly this list (one word, copied exactly):
${iconMenu}

Return ONLY this JSON object, with EXACTLY ${count} entries in "slides", in carousel order:
{
  "themeId": "${themeIds}",
  "slides": [
    { "headline": "string", "subheadline": "string", "nodes": ["string"], "icons": ["string"], "heroIcon": "string", "backgroundScene": "string" }
  ]
}

FIELDS, per slide:
- "headline": that slide's one point, in your own words. 2 to 6 words, at most 34 characters, Title Case. Specific and concrete, never a vague label, and never the post title copied verbatim. No quotation marks, no hashtags.
- "subheadline": ONE supporting line for that slide, at most 70 characters, plain sentence case, no ending period. Use "" if the slide needs none.
- "nodes": 2 to 4 short labels carrying that slide's detail, each 1 to 4 words and at most 28 characters, drawn strictly from the post. Use [] for the first and last slides so they render as clean statement slides.
- "icons": ONE concept from the icon list for EACH entry in that slide's "nodes", in the same order and the same length. Choose on meaning. Use [] when "nodes" is [].
- "heroIcon": ONE concept from the icon list representing that slide's point. Always provide this on every slide - it is what the hook and takeaway slides are built around.
- "backgroundScene": a short art direction for ONE premium, believable, TEXT-FREE photograph behind that slide, 15 to 35 words, specific to that slide's point. NO words, letters, numbers, charts, UI or logos - the text is drawn on top in code. Keep the slides visually related to each other: same world, same light, same mood, so the set hangs together.

RULES:
- Every slide must follow from the one before it and set up the one after it. A reader swiping through should feel one argument, not four separate posts.
- Everything must come from the post. Invent no facts, figures, statistics, claims or brand names.
- Spell every word correctly. These strings are rendered as-is, so a typo ships.
- No slide may repeat another slide's headline or point.
- Plain hyphens only, never em-dashes or en-dashes. No emojis. No markdown.
- Single-line plain text in every string, with no double-quote characters inside any value. No trailing commas. The output must parse with JSON.parse.

Return ONLY the JSON. No fences, no explanation.`;
}

/**
 * Brief for a PHOTOGRAPHIC image - the one meme format and the four realistic
 * scenes, which are the only categories still sent to an image model.
 *
 * It used to carry a second, much larger branch briefing a designed infographic.
 * Those formats are laid out in code now (lib/render-card.tsx) and take
 * buildDesignBriefPrompt instead, so the branch - and the `industry` parameter
 * only it used - are gone.
 */
export function buildImageBriefPrompt(
  title: string,
  body: string,
  postType: string,
  category: ImageCategory,
  userProfile?: UserVisualProfile
): string {
  const visualStyle = userProfile ? deriveVisualStyle(userProfile) : "";
  const profileBlock = visualStyle ? `\nROLE GROUNDING (keep the imagery true to this person's real work):\n${visualStyle}\n` : "";
  const role = userProfile?.headline || "professional";

  const personalRule = category.personal
    ? `This is a human/relatable format, but do NOT fabricate a portrait of a specific real person. Show a tasteful REPRESENTATIVE professional (over-the-shoulder, hands-only, a side or back angle, or no face at all) or just the real objects and workspace.`
    : `Carry the idea through one clear focal subject or metaphor, with atmosphere and depth; no implied specific person.`;

  return `You are a senior art director at a top agency. For the post below, brief ONE premium, believable, photoreal square (1:1) LinkedIn image in this exact FORMAT: ${category.label} - ${category.briefGuidance}.

POST TITLE (hook): ${title}
POST BODY: ${body}
POST TYPE: ${postType}
ROLE (whose world this scene lives in): ${role}
${profileBlock}
${personalRule}
Base the scene ONLY on what the post is actually about. Invent no facts. Do not add any brand or logo the post does not name; if it names a real one, show it in its genuine form and true official colours.

Return a brief as a JSON object with this EXACT structure:
{
  "style": "string (the photoreal or editorial look, e.g. natural-light documentary photo, clean editorial product shot)",
  "visual": "string (a rich art-director brief for the ONE scene - subject, setting, real objects, camera angle, lighting and mood - 40 to 80 words, single line, strictly from THIS post)",
  "headline": "string (a short on-image line ONLY if the format needs one, otherwise empty; at most 34 characters)",
  "caption": "string (for a MEME, one short punchy caption line; otherwise empty)",
  "palette": "string (the real colour and light mood of the scene, concrete colours, one line)",
  "theme": "string (one short line naming the overall mood and direction, from your read of the post)"
}

GUARDRAILS:
- A believable, physically real scene: correct proportions, genuine materials and textures, natural light. Never a fabricated portrait of a named person, never a garbled logo, never an obvious plastic AI surface.
- Keep any on-image text minimal, real, and correctly spelled. Invent no facts, statistics, or claims.
- Use plain hyphens only, never em-dashes or en-dashes.

${NO_EMOJI_RULES}

All string values must be single-line plain text with no line breaks and no double-quote characters inside them. Do not include trailing commas. The response must be a single JSON object parseable by JSON.parse with no preprocessing.

Return ONLY valid JSON. No markdown fences. No explanation. No emojis. Use plain hyphens, never em-dashes.`;
}

// ─── Single Post Regeneration ─────────────────────────────────────────────────

export function buildSinglePostPrompt(
  profileContext: string,
  title: string,
  postType: string,
  theme: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);

  return `You are an expert LinkedIn ghostwriter. Regenerate a single LinkedIn post with a fresh perspective.

PROFESSIONAL PROFILE:
${profileContext}

POST TOPIC: ${title}
POST TYPE: ${postType}
THEME: ${theme}

${rules}

Generate the post as a JSON object:
{
  "title": "string (compelling opening hook, max 150 chars)",
  "body": "string (full post body, max 1300 characters, use line breaks for readability)",
  "hashtags": ["string", "string", "string", "string", "string"],
  "imagePrompt": "string (short visual concept - describe a scene or metaphor, NO text/words to render)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}

// ─── Variant Post Prompt (A/B Testing) ───────────────────────────────────────

const VARIANT_STYLES: Record<string, string> = {
  "Bold & Direct": `STYLE: Bold & Direct
- Open with a strong, declarative statement or contrarian take
- Use confident, assertive language throughout
- Short, punchy paragraphs (1-2 sentences max)
- End with a direct challenge or provocative question
- Tone: commanding, no hedging, no "I think" - state it as fact`,

  "Personal Story": `STYLE: Personal Story
- Open with a first-person anecdote or a specific moment in time ("Last Tuesday, I...")
- Build a narrative arc: setup → tension → insight
- Use conversational, reflective tone
- Include a personal lesson or vulnerability
- End with how this experience changed your perspective`,

  "Practical & Tactical": `STYLE: Practical & Tactical
- Lead with the specific problem this solves
- Use numbered steps or a clear framework
- Include concrete examples, numbers, or tools
- Every sentence should be actionable - no fluff
- End with a quick-win the reader can apply today`,
};

export const VARIANT_STYLE_NAMES = Object.keys(VARIANT_STYLES);

export function buildVariantPostPrompt(
  profileContext: string,
  title: string,
  postType: string,
  theme: string,
  variantStyle: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);
  const styleInstructions = VARIANT_STYLES[variantStyle] ?? "";

  return `You are an expert LinkedIn ghostwriter. Create a LinkedIn post with a specific style and voice.

PROFESSIONAL PROFILE:
${profileContext}

POST TOPIC: ${title}
POST TYPE: ${postType}
THEME: ${theme}

${styleInstructions}

${rules}

Generate the post as a JSON object:
{
  "title": "string (compelling opening hook matching the style above, max 150 chars)",
  "body": "string (full post body, max 1300 characters, use line breaks for readability)",
  "hashtags": ["string", "string", "string", "string", "string"],
  "imagePrompt": "string (short visual concept - describe a scene or metaphor, NO text/words to render)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}

// ─── Content Repurposing ─────────────────────────────────────────────────────

const REPURPOSE_FORMATS: Record<string, { instructions: string; jsonShape: string }> = {
  "twitter-thread": {
    instructions: `FORMAT: Twitter/X Thread
- Break the content into 3-5 tweets
- Each tweet must be under 280 characters
- First tweet must be a strong hook that stands alone
- Number each tweet (1/N format)
- Maintain thread coherence - each tweet should flow naturally to the next
- Last tweet should have a CTA or key takeaway
- Include 1-2 relevant hashtags only in the last tweet`,
    jsonShape: `{ "tweets": ["string (tweet 1 - max 280 chars)", "string (tweet 2)", "..."] }`,
  },

  "blog-post": {
    instructions: `FORMAT: Blog Post
- Expand the LinkedIn post into a 600-800 word article
- Include a compelling title (H1) and 2-3 subheadings (H2 - prefix with ##)
- Write an engaging introduction paragraph (2-3 sentences)
- Develop each section with depth, examples, and practical insights
- Write a conclusion with a clear takeaway or CTA
- Use SEO-friendly language and natural keyword placement
- Do NOT use bullet points - use flowing paragraphs`,
    jsonShape: `{ "title": "string (SEO-friendly blog title)", "content": "string (full article with ## for H2 headings)" }`,
  },

  "email-newsletter": {
    instructions: `FORMAT: Email Newsletter Section
- Create a subject line (max 50 chars, compelling, no clickbait)
- Create a preview text (max 90 chars, complements the subject)
- Write the body as 2-3 paragraphs suitable for email
- Include a clear CTA (call-to-action) with specific action text
- Tone should be slightly more personal than LinkedIn - like writing to a subscriber
- Keep total body under 300 words`,
    jsonShape: `{ "subjectLine": "string (max 50 chars)", "previewText": "string (max 90 chars)", "body": "string (2-3 paragraphs)", "cta": "string (call-to-action text)" }`,
  },
};

export const REPURPOSE_FORMAT_NAMES = Object.keys(REPURPOSE_FORMATS);

export function buildRepurposePrompt(
  profileContext: string,
  postTitle: string,
  postBody: string,
  hashtags: string[],
  targetFormat: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);
  const fmt = REPURPOSE_FORMATS[targetFormat];
  if (!fmt) throw new Error(`Unknown repurpose format: ${targetFormat}`);

  return `You are an expert content repurposing specialist. Convert the following LinkedIn post into a different format.

PROFESSIONAL PROFILE:
${profileContext}

ORIGINAL LINKEDIN POST:
Title: ${postTitle}
Body: ${postBody}
Hashtags: ${hashtags.map((h) => `#${h}`).join(" ")}

${fmt.instructions}

${rules}

Generate the repurposed content as a JSON object:
${fmt.jsonShape}

Return ONLY valid JSON. No markdown fences. No explanation. No emojis.`;
}

// ─── Newsletter Prompt ────────────────────────────────────────────────────────

export function buildNewsletterPrompt(
  profileContext: string,
  pillars: object[],
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  return `You are an expert newsletter writer for LinkedIn professionals. Create a compelling ${monthName} ${year} LinkedIn newsletter.

PROFESSIONAL PROFILE:
${profileContext}

CONTENT PILLARS:
${JSON.stringify(pillars, null, 2)}

${NO_EMOJI_RULES}

Generate a full newsletter as a JSON object:
{
  "title": "string (newsletter name or edition title)",
  "subject": "string (email subject line, compelling, max 60 chars)",
  "intro": {
    "hook": "string (attention-grabbing opening paragraph, 2-3 sentences)",
    "preview": "string (what readers will get from this edition)"
  },
  "sections": [
    {
      "heading": "string",
      "content": "string (2-3 paragraphs of valuable insights, written like a human expert)",
      "keyTakeaway": "string (one sentence the reader should remember)"
    },
    {
      "heading": "string",
      "content": "string",
      "keyTakeaway": "string"
    },
    {
      "heading": "string",
      "content": "string",
      "keyTakeaway": "string"
    }
  ],
  "featuredInsight": {
    "quote": "string (a powerful insight or real stat, not a platitude)",
    "context": "string (why this matters)"
  },
  "cta": {
    "heading": "string",
    "text": "string (what action to take and why)",
    "action": "string (specific next step)"
  },
  "signoff": "string (personal, warm sign-off - 1-2 sentences)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}
