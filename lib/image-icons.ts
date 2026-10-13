import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Bell, BookOpen, Bot, Brain,
  Briefcase, Building2, Calendar, CheckCircle2, ClipboardList, Clock, Cloud, Code2,
  Compass, Cpu, Database, DollarSign, Eye, FileText, Filter, Flag, Flame, Folder,
  Gauge, GitBranch, Globe, Hammer, Heart, HelpCircle, Info, Key, Layers, LayoutGrid,
  Lightbulb, Link2, Lock, Mail, Map, MessageSquare, Package, PenLine, Phone, PieChart,
  Plug, Puzzle, RefreshCw, Repeat, Rocket, Route, Scale, Scissors, Search, Server,
  Settings, Share2, Shield, ShoppingCart, Sparkles, Star, Store, Target, ThumbsUp,
  TrendingDown, TrendingUp, Trophy, Truck, User, Users, Wrench, XCircle, Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon vocabulary for the code-rendered post images.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * The first version of the code renderer produced correct, legible, on-brand
 * typography - and nothing else. Every "infographic" was a headline over a stack
 * of rounded rectangles. That is not an infographic; it is a list. Real
 * information design carries a visual for each idea, and without one the images
 * read as cheap no matter how good the type is.
 *
 * Diffusion cannot be trusted to draw a labelled icon (it was never the right
 * tool for text), but it does not have to: lucide-react is already a dependency
 * and its icons are plain SVG paths, which Satori renders natively. So the model
 * picks a CONCEPT from the list below - a word, not a drawing - and the renderer
 * maps it to a real vector icon. Deterministic, free, and never garbled.
 *
 * Keys are deliberately plain English concepts rather than icon names, so the
 * model can choose on meaning ("what is this step about?") instead of having to
 * know a component library. Unknown or missing keys fall back by hashing the
 * label, which keeps a slide varied rather than stamping the same glyph on
 * every row.
 */

export const ICONS: Record<string, LucideIcon> = {
  // Direction and outcome
  growth: TrendingUp,
  decline: TrendingDown,
  target: Target,
  goal: Flag,
  win: Trophy,
  award: Award,
  rating: Star,
  approve: ThumbsUp,
  success: CheckCircle2,
  failure: XCircle,
  risk: AlertTriangle,
  question: HelpCircle,
  insight: Lightbulb,
  note: Info,

  // Measurement
  chart: BarChart3,
  breakdown: PieChart,
  metrics: Activity,
  speed: Gauge,
  money: DollarSign,
  time: Clock,
  schedule: Calendar,
  balance: Scale,

  // People
  customer: User,
  audience: Users,
  team: Users,
  hiring: Briefcase,
  company: Building2,
  market: Store,
  sales: ShoppingCart,
  global: Globe,

  // Communication
  email: Mail,
  message: MessageSquare,
  call: Phone,
  share: Share2,
  link: Link2,
  alert: Bell,
  visibility: Eye,
  engagement: Heart,

  // Build and ship
  launch: Rocket,
  speedup: Zap,
  trending: Flame,
  build: Hammer,
  fix: Wrench,
  tooling: Settings,
  integration: Plug,
  delivery: Truck,
  product: Package,

  // Technical
  code: Code2,
  data: Database,
  infrastructure: Server,
  cloud: Cloud,
  ai: Brain,
  automation: Bot,
  compute: Cpu,
  security: Shield,
  access: Lock,
  credentials: Key,
  search: Search,
  filter: Filter,

  // Process and structure
  process: Repeat,
  iterate: RefreshCw,
  branch: GitBranch,
  roadmap: Route,
  direction: Compass,
  map: Map,
  layers: Layers,
  structure: LayoutGrid,
  pieces: Puzzle,
  next: ArrowRight,
  cut: Scissors,

  // Content
  document: FileText,
  files: Folder,
  learning: BookOpen,
  writing: PenLine,
  checklist: ClipboardList,
  magic: Sparkles,
};

export const ICON_KEYS = Object.keys(ICONS);

/** The vocabulary, formatted for the brief prompt. */
export function iconMenuBlock(): string {
  return ICON_KEYS.join(", ");
}

/**
 * Resolve a concept to an icon.
 *
 * `seed` (the label the icon sits next to) makes an unrecognised or missing
 * concept fall back DETERMINISTICALLY but variedly - the same label always gets
 * the same icon, while different labels on one slide still differ. Returning a
 * single default instead would put the identical glyph on every row, which
 * looks worse than no icons at all.
 */
export function resolveIcon(concept: string | null | undefined, seed = ""): LucideIcon {
  const key = (concept ?? "").trim().toLowerCase();
  if (ICONS[key]) return ICONS[key];

  let h = 0;
  const basis = seed || key || "x";
  for (let i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) | 0;
  return ICONS[ICON_KEYS[Math.abs(h) % ICON_KEYS.length]];
}
