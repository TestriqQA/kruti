# App Requirements Form — Kruti.io

> Sab figures 24 Oct 2026 ko is repo, live site, database aur blob store se
> naape gaye hai. Jo nahi pata uske aage `?` hai — andaaza nahi lagaya gaya.

**App: Kruti.io**

## 1. Basic

| Sawaal | Jawab |
|---|---|
| App ka naam | **Kruti.io** (repo/package naam: `linkedin-content-platform`) |
| GitHub repo URL | **https://github.com/TestriqQA/kruti** (private) |
| Abhi kahan live hai + URL | **Vercel** — https://kruti.io (HTTP 200, header `Server: Vercel`, `X-Vercel-Id: bom1::iad1` = Mumbai edge, US-East function region) |
| Type | **Web app (SaaS)** + **admin panel** (`/admin/*`) + **REST API** (60 route handlers) + **7 scheduled cron jobs**. Teeno ek hi Next.js deployment me hai. |
| Agar backend hai: kis mobile app ke liye | **Haan** — ek companion mobile app hai. Custom URL scheme `krutimobile://oauth-callback`. Do dedicated endpoints: `/api/auth/mobile-callback` (LinkedIn OAuth → NextAuth-compatible JWT) aur `/api/auth/me` (Bearer JWT validate karke user data). App ka naam/repo alag hai — `?` |

## 2. Tech stack

| Sawaal | Jawab |
|---|---|
| Framework + version | **Next.js 14.2.35** (App Router) · React 18.3.1 · TypeScript |
| Runtime + version | **Node.js** — `package.json` me koi `engines` field **nahi** hai, abhi Vercel ka default chal raha hai. Local dev Node **v24.16.0** pe hai. **AWS pe version pin karna padega** (Next 14 ke liye Node 20 ya 22 LTS recommended) |
| Package manager | **npm** (`package-lock.json`, npm 11.13.0) |
| Build command | **`npm run build`** → `prisma generate && next build` |
| Start command | **`npm start`** → `next start` |
| App kis port par chalti hai | **3000** (`next start` ka default; `PORT` env se override hota hai). Dev script 3002 use karta hai |
| Dockerfile / docker-compose | **Dono nahi hai.** AWS (ECS/EB/EKS) ke liye banana padega |

## 3. Database aur storage

| Sawaal | Jawab |
|---|---|
| Database + version | **PostgreSQL 17.6** (Prisma 5.22 ORM) |
| Abhi DB kahan hosted hai | **Supabase** — `aws-1-ap-south-1.pooler.supabase.com` (AWS Mumbai). Do connections: pooled port **6543** (`?pgbouncer=true`, app isse chalta hai) aur direct port **5432** (schema changes ke liye) |
| DB ka size lagbhag | **13 MB** (naapa hua). Sabse badi tables: `Post` 144 rows / 672 kB, `ContentPlan` 18 rows / 256 kB, `User` 10 rows / 136 kB |
| Redis / queue / cache | **Nahi hai.** Rate limiting abhi **in-memory, per-process** hai (`lib/rate-limit.ts`). **Ye multi-instance pe toot jayega** — AWS pe 1 se zyada instance chalane se pehle Redis/ElastiCache chahiye |
| User file uploads | **Vercel Blob** — abhi **106 files, 145 MB** kul. Breakdown: `carousel/` 70 files 122.6 MB · `generated/` 13 files 20.4 MB · `support/` 19 files 1.1 MB · `cropped/` 4 files 0.8 MB. Code me **8 files `@vercel/blob` import karti hai** — AWS pe S3 pe shift karna hoga, ya Vercel Blob token ke saath rakhna hoga |

## 4. Extra kaam

| Sawaal | Jawab |
|---|---|
| Cron jobs / scheduled tasks | **7**, abhi `vercel.json` se chalte hai (HTTP routes hai, alag worker nahi):<br>• `/api/cron/auto-post` — **har 5 min** (due posts LinkedIn pe publish, ek run me 1)<br>• `/api/cron/newsletter` — **har 15 min**<br>• `/api/cron/trial-reminders` — roz 08:00<br>• `/api/cron/profile-alerts` — roz 09:00<br>• `/api/cron/image-cleanup` — roz 03:00<br>• `/api/cron/token-refresh` — roz 06:00<br>• `/api/cron/support-cleanup` — roz 04:00<br>**AWS pe EventBridge Scheduler (ya cron + curl) se replace karna padega** |
| Background / queue workers | **Koi alag worker nahi.** Lamba kaam HTTP request ke andar hi hota hai, NDJSON stream se progress bhejta hai. Generation routes pe `maxDuration = 60` set hai |
| WebSockets / real-time | **Nahi.** Progress NDJSON streaming se jaata hai (plain HTTP), socket.io/ws kuch nahi |
| Heavy kaam | **Haan, kaafi:**<br>• **AI image generation** — har image ek external model call, **naapa hua 33–43 sec**<br>• **`sharp` 0.34.5** — image resize/composite (native binary, platform-specific build chahiye)<br>• **`satori` 0.51.0** — JSX → SVG render (fallback path)<br>• **`pdf-lib` 1.17.1** — carousel ko PDF banakar LinkedIn pe post karna<br>• Puppeteer / headless Chrome / video processing — **nahi hai** |
| Third-party services | • **Google Gemini API** (`@google/genai`) — text + image generation<br>• **LinkedIn API** — OAuth login + posting (`api.linkedin.com`, 7 jagah)<br>• **Razorpay** — subscriptions/payments + webhook<br>• **Resend** — transactional email (newsletters, trial reminders)<br>• **Vercel Blob** — file storage<br>• **NextAuth v4** — auth (LinkedIn OIDC only)<br>• Recraft API — code me integrate hai par abhi band (`IMAGE_PROVIDER` se switch hota hai) |

## 5. Domain aur traffic

| Sawaal | Jawab |
|---|---|
| Domain / subdomain | **kruti.io** (apex). Koi alag `api.` subdomain nahi — API usi domain pe `/api/*` par hai |
| DNS kahan manage hota hai | **?** — repo se pata nahi chalta. Abhi Vercel serve kar raha hai, par registrar/DNS provider confirm karna padega |
| Roz ke users / visitors | **Registered users: 10** (7 pichle 30 din me active). Subscriptions: 7 active, 3 trialing.<br>**Daily visitors: ?** — app me analytics nahi hai, ye Vercel Analytics se lena padega |
| Mobile app API ko kaise call karti hai | **Domain se** — `kruti.io/api/*`. OAuth callback custom scheme `krutimobile://oauth-callback` pe return karta hai. (Code comment me ngrok ka zikr hai, yaani dev me tunnel use hota tha) |

## 6. Resource usage

| Sawaal | Jawab |
|---|---|
| App kitni RAM use karti hai | **~166 MB** warm idle (`next start`, naapa hua: main process 101 MB + child 65 MB).<br>**Peak isse kaafi zyada hoga** — carousel ek saath **4 images parallel** banata hai, har ek 1–2 MB buffer + sharp processing. **Minimum 1 GB, comfortable 2 GB** rakhna chahiye |
| Build me kitna time lagta hai | **146 seconds** (clean build, naapa hua). Build output `.next/` = **287 MB**. 100 pages generate hote hai |

## 7. Migration

| Sawaal | Jawab |
|---|---|
| Kitna downtime chal sakta hai | **?** — business call. Dhyan rahe: `auto-post` cron **har 5 minute** chalta hai aur scheduled posts LinkedIn pe daalta hai, to lamba downtime kuch posts ka slot miss kar sakta hai (72h+ purane posts skip ho jaate hai) |
| Priority / deadline | **?** |

---

## AWS move se pehle ye dekh lena (migration me yahi atkega)

Ye form me nahi pucha gaya, par code se nikla hai:

1. **In-memory rate limiting multi-instance pe tootega.** `lib/rate-limit.ts` process-local hai — 2 instances pe user ko dugni limit mil jayegi. Redis/ElastiCache chahiye, ya single instance se shuru karo.
2. **`@vercel/blob` 8 files me hai.** S3 pe shift karna ek chhota refactor hai (ek wrapper ke peeche daal do), ya Vercel Blob token ke saath bahar se bhi chalta hai.
3. **Crons `vercel.json` me hai** — wo AWS pe apne aap nahi chalenge. EventBridge Scheduler → HTTP endpoints, aur routes pe auth add karna padega (abhi Vercel ka cron header bharosa hai).
4. **Dockerfile banana padega**, aur `sharp` ke liye platform-matching binary chahiye (`--platform=linuxmusl` ya glibc image).
5. **Timeout ≥ 60s chahiye.** Image generation naapa hua 33–43 sec. ALB ka default idle timeout 60s hai — badhana padega, warna carousel beech me kat jayega.
6. **Build ke waqt internet chahiye** — `next/font` Google Fonts (`fonts.gstatic.com`) se Inter fetch karta hai. Is build me 2 baar wo request fail hui (fallback se build pass ho gaya), par closed network me ye problem banegi. Fonts self-host karna behtar hoga.
7. **Database abhi bhi Supabase pe rahega** jab tak aap RDS pe shift na karo. Achhi baat — Supabase bhi **AWS ap-south-1** pe hai, to app ko usi region me rakhoge to latency kam rahegi.
8. **Prisma me migrations folder nahi hai** (`db push` workflow). Production pe schema change karne ka tareeka tay karna hoga.
