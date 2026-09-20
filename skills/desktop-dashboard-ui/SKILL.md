---
name: desktop-dashboard-ui
title: Desktop Dashboard Design System & Typography
category: Design
description: Production design system skill for high-density desktop dashboards: min-max breakpoint grid column systems, sidebar-adaptive layout transitions, system-font typography hierarchies, subpixel/grayscale text rendering, and WCAG AA/AAA compliance.
version: 1.0.0
---

# Desktop Dashboard UI Design System & Typography Skill

Specialized design system and engineering guidelines for building high-density, professional developer and observability dashboards exclusively targeted at **desktop screens** (1024px to 2560px+ ultrawide displays).

---

## 1. Core Principles

### 1.1 Desktop-Only Focus
- Dashboards in developer and observability workflows are viewed on desktop monitors (laptops 13"-16", 1080p, 1440p, 4K, and 21:9/32:9 ultrawide screens).
- Do not sacrifice desktop information density, multi-column bento layouts, or split inspector drawers for mobile compromise patterns.
- Preserve dedicated multi-pane layouts: Left Navigation (collapsible), Main Command Hub / Feed Grid, and Deep Right Inspector.

### 1.2 System-Only Typography (Zero External Font Dependencies)
- Dashboards must operate 100% offline, privacy-safe, and load with 0ms FOUT (Flash of Unstyled Text).
- **Never import external web fonts** (Google Fonts, Typekit, CDNs).
- Adopt calibrated native OS and browser font stacks:
  ```css
  /* Body & General Interface */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

  /* Headings & Display Titles */
  --font-heading: var(--font-sans);

  /* Code, Hashes, Metrics, Timestamps, Table Cells */
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  ```
- Always apply `font-variant-numeric: tabular-nums` to numbers, dates, durations, and counts to avoid layout shifts.

### 1.3 Mathematical Type Scale Tokens
Organize typography by harmonic ratios rather than ad-hoc pixels:
- **Display**: `calc(var(--font-size-base) * var(--type-ratio)^4)` — Large stat callouts
- **H1**: `calc(var(--font-size-base) * var(--type-ratio)^3)` — Primary view header
- **H2**: `calc(var(--font-size-base) * var(--type-ratio)^2)` — Section header
- **H3**: `calc(var(--font-size-base) * var(--type-ratio))` — Card & panel title
- **H4 / Base**: `var(--font-size-base)` (14px / 0.875rem) — Default body & table text
- **Caption**: `calc(var(--font-size-base) / var(--type-ratio))` (~11.6px) — Metadata, labels
- **Micro**: `0.6875rem` (11px minimum for WCAG 2.2 readability) — Eyebrows, pill badges

---

## 2. Responsive Min/Max Breakpoint Grid Column System

### 2.1 The Problem with Naive Viewport Grids
Standard viewport-based grid media queries (`sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) break down inside complex dashboards because:
1. The left sidebar can be expanded (`256px`) or collapsed to icon-only (`48px`).
2. The right inspector drawer can be opened (`480px-580px`) or closed (`0px`).
3. Viewport width does not reflect the *actual inline space* available to the cards.

### 2.2 Container Queries + CSS Grid MinMax
Use CSS Container Queries (`@container`) on the card feed container combined with CSS Grid `repeat(auto-fill, minmax(min(100%, <min-width>), 1fr))`:

```tsx
/* Feed Container */
<div className="@container/feed flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
  {/* Adaptive Multi-Column Card Grid */}
  <div className="grid grid-cols-1 @[640px]/feed:grid-cols-2 @[1120px]/feed:grid-cols-3 @[1580px]/feed:grid-cols-4 gap-3.5">
    {cards.map(card => (
      <CardItem key={card.id} card={card} />
    ))}
  </div>
</div>
```

### 2.3 Breakpoint Behavior Matrix
| Available Feed Inline Width | Columns | Min Card Width | Behavior |
| :--- | :---: | :---: | :--- |
| `< 640px` (Inspector open on laptop) | 1 column | 100% | Full width, readable line length |
| `640px - 1119px` (Standard desktop with inspector) | 2 columns | ~340px | Bento paired comparison |
| `1120px - 1579px` (1440p desktop or inspector closed) | 3 columns | ~360px | High-density grid overview |
| `>= 1580px` (Ultrawide 1920px+ monitors) | 4 columns | ~380px | Command center cockpit |

---

## 3. Sidebar-Adaptive Transitions

### 3.1 Fluid Geometry
When the layout state toggles:
- **Left Sidebar Toggle**: Immediately updates inline space by `+208px` (expanded to collapsed) or `-208px`.
- **Right Inspector Toggle**: Adjusts inline space by `+480px` (closed) or `-480px` (open).
Because the grid uses `@container/feed`, column recalculations happen instantaneously without layout jumps or overflow clipping.

### 3.2 Card Internal Adaptation
Each card is built with flexbox column geometry (`flex flex-col justify-between h-full`):
- **Card Top**: Type badge, project pill, and timestamp.
- **Card Center**: Semantic heading (`font-heading font-bold text-sm leading-snug`) and clamped summary (`line-clamp-2` or `line-clamp-3`).
- **Card Bottom**: Tag pills and metadata footer pinned to bottom.

---

## 4. Deep Visual Hierarchy in Right Sidebars (Inspectors)

To make a right sidebar readable and avoid flat, monotonous text:
1. **Width Allocation**: Allocate `480px` to `580px` on desktop displays to allow code snippets and diffs to breathe.
2. **Elevated Summary Card**: Enclose the core takeaway in a dedicated card with subtle background tint and distinct border.
3. **Numbered Breakdown Cards**: Convert list items ("What Changed") into discrete mini-cards with high-contrast numbered badges (`#1`, `#2`).
4. **Callout Accent Blocks**: Use left-accent borders (`border-l-2 border-primary`) for architectural decisions and rationale.
5. **High-Contrast Tab Pills**: Ensure active tabs have unmistakable foreground/background contrast with visible 2px focus rings.

---

## 5. Text Rendering & Legibility Engineering

### 5.1 Subpixel Antialiasing (LCD ClearType)
For standard LCD desktop displays:
```css
.text-render-subpixel,
[data-text-rendering="subpixel"] {
  -webkit-font-smoothing: subpixel-antialiased;
  -moz-osx-font-smoothing: auto;
  text-rendering: optimizeLegibility;
}
```
Sharpens thin strokes, increases letterform contrast, and eliminates blurry text on non-Retina desktop screens.

### 5.2 Grayscale Antialiasing (OLED & Retina)
For high-DPI displays (MacBook Retina, 4K monitors, OLED panels):
```css
.text-render-grayscale,
[data-text-rendering="grayscale"] {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```
Prevents color fringing on high-density subpixel layouts.

---

## 6. WCAG 2.2 AA / AAA Compliance Checklist

- [x] **Contrast Ratios**: Normal text (below 18pt) achieves `>= 4.5:1` against card backgrounds. Large text (headings `>= 18.5px bold`) achieves `>= 3:1`.
- [x] **Focus Indicators**: Every interactive card, button, tab, and row implements `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none`.
- [x] **Non-Color Indicators**: Status badges (success, error, warning) always couple color with an icon and text label (SC 1.4.1).
- [x] **Target Sizing**: All click/keyboard targets have minimum dimensions of 24x24px (WCAG 2.2 SC 2.5.8).
- [x] **Keyboard Navigability**: Full Tab and Enter/Space navigation across cards, tabs, and sheet inspectors.
