# Skill Registry — SFS Web

Generated: 2026-08-09 | Mode: engram

## Project Skills

| Skill | Path | Trigger |
|-------|------|---------|
| next-best-practices | `.agents/skills/next-best-practices/SKILL.md` | Next.js file conventions, RSC boundaries, async APIs, metadata, image/font optimization |
| vercel-react-best-practices | `.agents/skills/react-best-practices/SKILL.md` | React/Next.js performance, data fetching, bundle optimization, re-renders |
| tailwind-css-patterns | `.agents/skills/tailwind-css-patterns/SKILL.md` | Tailwind v4.1+ CSS-first config, responsive design, dark mode |
| typescript-advanced-types | `.agents/skills/typescript-advanced-types/SKILL.md` | Generics, conditional types, mapped types, template literals |
| next-upgrade | `.agents/skills/next-upgrade/SKILL.md` | Next.js version upgrades |
| next-cache-components | `.agents/skills/next-cache-components/SKILL.md` | Next.js cache components |
| composition-patterns | `.agents/skills/composition-patterns/SKILL.md` | React component composition |
| frontend-design | `.agents/skills/frontend-design/SKILL.md` | Frontend design patterns |
| seo | `.agents/skills/seo/SKILL.md` | SEO, meta tags, structured data, sitemap, crawlability |
| accessibility | `.agents/skills/accessibility/SKILL.md` | Accessibility (a11y) patterns |

## Compact Rules

### next-best-practices
- `middleware.ts` is renamed to `proxy.ts` in Next.js 16
- Async Server Components: do NOT make client components async
- Server Actions: always auth-check inside the action, not in middleware
- Route Handlers: `params` and `searchParams` are Promises in Next.js 16 (`await params`)
- Use `next/image` for all images; never use raw `<img>` tags
- Use `next/font` for font loading; never use Google Fonts CDN

### vercel-react-best-practices
- Eliminate waterfalls: start promises early, await late. `Promise.all()` for independent ops
- Avoid barrel file imports from icon/component libraries; use direct imports
- Dynamic imports for heavy components (`next/dynamic` with `ssr: false`)
- `React.cache()` for per-request deduplication of DB/auth calls
- Do NOT define components inside components — causes remount on every render
- Use `useTransition` for non-urgent state updates, `useDeferredValue` for expensive renders
- Derive state during rendering instead of syncing with `useEffect`
- Use functional `setState` updates when new state depends on current state

### tailwind-css-patterns
- Tailwind v4 uses CSS-first configuration (`@theme` in CSS, not `tailwind.config.js`)
- Breakpoints: `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280, `2xl:` 1536
- Dark mode: use `dark:` variant (media-query based by default in v4)
- Use `@utility` directive for custom utilities in v4
- Prefer `@container` queries for component-level responsiveness over viewport-only breakpoints

### typescript-advanced-types
- Prefer `type` over `interface` for object types unless declaration merging is needed
- Use `satisfies` operator for type-checking without widening
- Use template literal types for string patterns (`as`, string unions)
- Use `const` type parameters for literal inference in generics
- Avoid `any`; use `unknown` and narrow with type guards

### seo
- `generateMetadata()` for dynamic page titles, descriptions, OG images
- JSON-LD structured data for rich snippets (SportsActivityLocation for canchas)
- Canonical URLs on every page
- Sitemap + robots.txt required for indexing
- Semantic HTML: `<main>`, `<article>`, `<nav>`, proper heading hierarchy

## Convention Files

| File | Content |
|------|---------|
| `AGENTS.md` | Next.js 16 agent rules (breaking changes warning) |
| `CLAUDE.md` | Redirects to AGENTS.md |

## Stack Summary

- **Frontend**: Next.js 16 App Router + React 19 + TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 (PostCSS)
- **Database**: Prisma + Supabase PostgreSQL
- **Auth**: JWT (jose + bcryptjs), cookies HttpOnly
- **Maps**: Leaflet + React-Leaflet
- **PWA**: Serwist (Service Worker)
- **Package manager**: pnpm workspaces (monorepo)
- **Linting**: ESLint (next/core-web-vitals + typescript)
- **Formatter**: None configured
- **Testing**: None (Vitest planned but not installed)
