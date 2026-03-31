# Lasu — Design System

## Aesthetic

The entire app is a navigator's journal. Every screen — landing, login, dashboard, settings — lives on the same warm parchment surface. Pen-and-ink illustrations, serif typography, thin ruled lines, wax-seal accents. The product feels like a personal artifact, not a tech platform. You're reading someone's notebook and it happens to be alive.

The ocean reference is subtle: it lives in the subject matter of illustrations (compass roses, coastlines, wave contours), in the copy metaphors ("anchored", "charting a course"), and in occasional cool-toned accents for interactive elements. But the surface is always paper.

## Typography

**Instrument Serif** is the primary typeface. Sharp terminals, modern but with real character. Literary without being old-fashioned. Import from Google Fonts.

**Inter** is the secondary typeface for functional UI: form labels, input text, button labels, stat values, timestamps, metadata. Anywhere precision and density matter more than mood.

### Scale

| Role | Font | Size | Weight | Color | Notes |
|------|------|------|--------|-------|-------|
| Hero heading | Instrument Serif | 64-80px | 400 | Ink | Landing page only. Tight tracking (-0.02em). |
| Page heading (h1) | Instrument Serif | 28-32px | 400 | Ink | Dashboard greeting, page titles. |
| Section heading (h2) | Instrument Serif | 20-22px | 400 | Ink | |
| Subheading (h3) | Instrument Serif | 16-18px | 400 | Faded Ink | |
| Body | Instrument Serif | 16-17px | 400 | Faded Ink | Line-height 1.7. Max-width 560px for reading. |
| Small body | Instrument Serif | 14-15px | 400 | Graphite | Descriptions, secondary content. |
| Tagline | Instrument Serif | 13-14px | 400 | Pencil | Uppercase, letter-spacing 0.15em. |
| UI label | Inter | 11-12px | 500 | Pencil | Uppercase, letter-spacing 0.04em. Stat cards, category headers. |
| UI value | Inter | 22px | 500 | Ink | Stat card numbers. |
| UI body | Inter | 13-14px | 400 | Faded Ink | Activity feed text, form inputs, metadata. |
| Timestamp | Inter | 11px | 400 | Pencil | Relative time. |
| Button text | Inter | 13-14px | 500 | — | Depends on button style. |
| Input text | Inter | 15px | 400 | Ink | |
| Nav item | Inter | 13px | 500 | — | Sidebar navigation. |
| Logo subtitle | Instrument Serif | 12px | 400 italic | Pencil | "your personal AI spirit" |

**Rules:**
- Two weights only: 400 and 500. Never 600 or 700.
- Sentence case everywhere. Never Title Case.
- No letter-spacing on Instrument Serif body text. Only on uppercase labels and taglines.
- Italic Instrument Serif for: logo subtitle, empty state messages, pull-quotes, the occasional poetic fragment. Sparingly.

## Color Palette

### Ink and Paper (primary surface)

| Token | Hex | Usage |
|-------|-----|-------|
| Parchment | `#F5F0E3` | Page background everywhere |
| Aged Paper | `#EBE5D5` | Card backgrounds, sidebar bg, secondary surfaces |
| Vellum | `#E0DAC8` | Deeper surface for contrast (selected states, hover) |
| Ruled Line | `#C5BFA8` | Borders, dividers, thin rules |
| Pencil | `#8A877E` | Tertiary text, labels, timestamps, muted UI |
| Graphite | `#6B6860` | Secondary text, descriptions |
| Faded Ink | `#3D3D3A` | Body text, primary readable content |
| Iron Gall | `#2C2A25` | Illustration strokes, decorative elements |
| Ink | `#1A1A18` | Headings, strongest text, primary borders |

### Warm Accents (wax seal)

Used for CTAs, attention markers, active/important states. The only saturated warm color in the palette.

| Token | Hex | Usage |
|-------|-----|-------|
| Wax Seal | `#D4845A` | Primary CTA, active states, warm attention |
| Seal Dark | `#B56E45` | CTA hover |
| Seal Light | `#E8A87C` | Pressed state, secondary warm |
| Seal Wash | `#FAE6D0` | Warm badge bg, subtle warm tint |

### Cool Accents (saltwater)

Used sparingly for interactive elements, links, info states. The ocean enters through these — not as surfaces, but as ink color.

| Token | Hex | Usage |
|-------|-----|-------|
| Tide | `#2B7A9E` | Links, interactive elements, focus rings |
| Shallows | `#5BB5C9` | Hover state for links, secondary interactive |
| Mist | `#E0F4F7` | Info badge bg, cool tint |
| Deep | `#0F2942` | Only for dark-on-light moments (dark badge text on cool bg) |

### Signals

| Token | Hex (bg) | Hex (text) | Usage |
|-------|----------|------------|-------|
| Connected | `#E8F5EE` | `#1A6B47` | Success, healthy, active |
| Warning | `#FFF5ED` | `#8B5A33` | Caution, pending |
| Error | `#FDE8E8` | `#791F1F` | Disconnected, failed |
| Info | `#E0F4F7` | `#0C447C` | Informational |

### Dark Mode

Dark mode inverts the paper, not the palette. Think: the same journal, read by lamplight. Warm-dark, not cold-dark.

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| Page bg | `#F5F0E3` | `#1C1A15` | Deep warm brown, not blue-black |
| Card bg | `#EBE5D5` | `#262219` | |
| Sidebar bg | `#EBE5D5` | `#1C1A15` | |
| Primary text | `#1A1A18` | `#E5DFD0` | |
| Secondary text | `#3D3D3A` | `#B5AE9E` | |
| Tertiary text | `#8A877E` | `#7A7468` | |
| Borders | `#C5BFA8` | `#3A3530` | |
| Illustrations | `#2C2A25` | `#E5DFD0` at low opacity | |

## Illustrations

Pen-and-ink line art. The defining visual element. Present on the landing page as large ambient decoration, and as small moments throughout the app (empty states, section dividers, loading states).

**Style:**
- Stroke only. No fills, no solid shapes.
- Stroke color: Iron Gall (`#2C2A25`). Use opacity to control weight (0.12-0.2 for background watermarks, 0.6-1.0 for foreground).
- Stroke widths: 1-1.5px for detail, 2-3px for emphasis. Variation gives the hand-drawn feel.
- Crosshatching for shadow: parallel lines at ~45deg, 3-4px spacing.
- Subjects: nautical and cartographic. Compass roses, coastline contours, wave patterns, navigation lines, constellation fragments, rope details. Abstract and decorative.
- Embedded as inline SVGs, not image files.

**Placement:**
- Landing hero: large decorative SVG behind text at 0.12-0.18 opacity.
- Section dividers: thin ruled line with a small centered ornament (compass star, wave, knot). 16-24px.
- Empty states in the app: small illustration (64-96px) above the message.
- Loading states: a subtle animated compass needle or gentle wave line.
- Never inside cards. Never next to feature descriptions. Illustrations are atmosphere, not content.

## Layout and Spacing

- **Page background**: Parchment everywhere. No full-bleed dark sections.
- **Border radius**: 8-10px cards, 8px buttons/inputs, 6px badges, 50% avatars/dots.
- **Borders**: 1px solid Ruled Line on the landing page. 0.5px solid Ruled Line in the app (denser UI needs thinner borders).
- **Card padding**: 16-20px in the app. 24-32px on the landing page.
- **Spacing scale**: 4, 8, 12, 16, 20, 24, 32, 48, 64, 80px.
- **Content max-width**: 560px for centered reading text, 960px for app dashboard content.
- **Sidebar width**: 200px, fixed.

## Components

### Navigation (Landing)

- Full-width, transparent over parchment. Padding: 24px 40px.
- Left: "LASU" in Ink, Inter, 13px, uppercase, letter-spacing 0.15em.
- Right: "Log in" in Pencil, Inter, 13px. Underline on hover.
- No background, no border, no sticky. Scrolls with the page.

### Sidebar (App)

- Background: Aged Paper (`#EBE5D5`). Not dark. This is slightly deeper parchment.
- Logo: "Lasu" in Ink, Instrument Serif, 18px. Below: "your personal AI spirit" in Pencil, Instrument Serif italic, 12px.
- Nav items: Inter, 13px, 500 weight. Color: Graphite. Padding: 8px 12px, 8px radius.
- Active nav item: Vellum (`#E0DAC8`) bg, Ink text.
- Hover: Vellum bg.
- Icons: 16x16, stroke-only, 1.5px, Graphite. Active: Ink.
- Divider between nav and user: Ruled Line, 0.5px.
- User avatar: 32px circle, Ruled Line border, Pencil initials on Parchment bg.

### Buttons

**Primary (wax seal):**
- Wax Seal bg, white text (`#FFFDF8`), 8px radius.
- Hover: Seal Dark. Active: Seal Light.
- 44-48px height, 12px 28px padding, Inter 14px 500.

**Secondary (ink outlined):**
- Transparent bg, 1px Ruled Line border, Faded Ink text.
- Hover: Vellum bg. Active: Aged Paper bg.
- Same dimensions as primary.

**Ghost:**
- No border, Graphite text.
- Hover: Vellum bg.

### Inputs

**Landing page (phone input):**
- Bottom-border only. 1px Ruled Line. No box.
- Instrument Serif, 18px, Ink text. Placeholder: Pencil, italic.
- Focus: border transitions to Ink.

**App forms:**
- Full border. 0.5px Ruled Line, 8px radius.
- Aged Paper bg.
- Inter, 15px, Ink text. Placeholder: Pencil.
- Focus: 2px Tide ring.

### Cards (App)

- Background: Aged Paper (`#EBE5D5`).
- Border: 0.5px Ruled Line.
- Radius: 10px.
- Padding: 16px.

### Stat Cards

- Same card style as above.
- Label: Inter, 11px uppercase, Pencil, 0.04em spacing.
- Value: Inter, 22px, 500 weight, Ink.
- Subtitle: Inter, 11px. Connected green for positive, Pencil for neutral.
- Grid: 3 columns, 10-12px gap.

### Activity Feed

- Each item in a card. 12px 14px padding.
- Status dot: 8px circle, left side. Green = done, Tide = in progress, Pencil = passive.
- Text: Inter, 13px, Faded Ink. Line-height 1.5.
- Timestamp: Inter, 11px, Pencil. Relative time.
- Badges: 11px Inter 500, 2px 8px padding, 6px radius.

### Feature Cards (Landing)

- No fill (transparent, parchment shows through). Or very faint Aged Paper.
- Border: 1px Ruled Line. Radius: 8px.
- Padding: 24-32px.
- Title: Instrument Serif, 18px, Ink.
- Description: Instrument Serif, 15px, Graphite. Line-height 1.6.

### Badges / Pills

- 2px 8px padding, 6px radius, Inter 11px 500.
- Use Signal palette for bg and text colors.

### Empty States

- Centered, max-width 320px.
- Small pen-and-ink SVG illustration (64-96px).
- Heading: Instrument Serif, 16px, Ink.
- Body: Instrument Serif italic, 14px, Pencil.
- CTA: primary button.

## Personality

- Ocean metaphors in status copy: "Sailing smoothly" (ok), "Charting a course..." (loading), "Anchored" (connected), "Lost signal" (error), "Welcome aboard" (onboarding complete).
- Don't force the metaphor. Plain language when it's clearer.
- Dashboard greeting by time of day.
- Relative timestamps always.
- No mascot. No emoji. Personality lives in the serif type, the ink illustrations, and the occasional warm word.

## Micro-animations

- Hover transitions: 150ms ease.
- Card hover: border Ruled Line to Graphite, 150ms.
- Activity feed new item: slide down + fade in, 250ms ease.
- Page transitions: 200ms fade.
- Loading: shimmer on Aged Paper colored skeleton blocks.
- Respect `prefers-reduced-motion`: disable all.

## Do Not

- No gradients on any surface.
- No drop shadows (except focus rings).
- No glow, neon, or bloom effects.
- No dark backgrounds anywhere (light mode). The sidebar is Aged Paper, not navy.
- No emoji.
- No literal ocean photographs or water textures.
- No illustrations inside cards or next to feature text.
- No font weight above 500.
- No Title Case.
- No colored section backgrounds. Parchment everywhere. Color comes from ink, wax seal accents, and saltwater interactive elements.
- No stock illustrations. All line art is hand-drawn style, consistent stroke weight and subject matter.
- No sans-serif for headings or body text. Sans is only for functional UI (labels, values, inputs, buttons, nav, metadata).
