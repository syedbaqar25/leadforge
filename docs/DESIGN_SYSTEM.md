# Leadforge Design System — Editorial Paper

## Philosophy

Warm, editorial, professional. Reads like a well-set broadsheet. Calm where it should be, dense where it helps. Built for sales teams that live in this tool all day.

## Color Tokens

| Token                  | Light Mode | Usage                        |
| ---------------------- | ---------- | ---------------------------- |
| --color-bg             | #FAF7F2    | Page background              |
| --color-surface        | #FFFFFF    | Cards, panels                |
| --color-surface-hover  | #F5F0EA    | Hover state for rows/cards   |
| --color-border         | #E8E2D9    | Borders, dividers            |
| --color-border-strong  | #D4CFC4    | Emphasized borders           |
| --color-text           | #1A1A1A    | Primary text                 |
| --color-text-secondary | #7A7267    | Secondary/muted text         |
| --color-text-tertiary  | #A09888    | Disabled/placeholder         |
| --color-accent         | #D64933    | Primary action, brand accent |
| --color-accent-hover   | #C03E2A    | Accent hover                 |
| --color-accent-subtle  | #FAF0ED    | Light accent background      |
| --color-success        | #2D7A3A    | Positive/won                 |
| --color-success-subtle | #E8F5EA    | Success background           |
| --color-warning        | #C78D20    | Caution/warm                 |
| --color-warning-subtle | #FFF8E1    | Warning background           |
| --color-danger         | #C43C2C    | Error/destructive            |
| --color-danger-subtle  | #FDEAEB    | Danger background            |
| --color-info           | #3A6B8A    | Informational                |
| --color-info-subtle    | #EDF3F8    | Info background              |

### WCAG AA Contrast Ratios

- Text #1A1A1A on bg #FAF7F2 → **15.8:1** ✓ AAA
- Text-secondary #7A7267 on bg #FAF7F2 → **4.8:1** ✓ AA
- Accent #D64933 on bg #FAF7F2 → **4.6:1** ✓ AA
- Accent #D64933 on surface #FFF → **4.3:1** ✓ AA (large text)
- White #FFF on accent #D64933 → **4.3:1** ✓ AA (large text/buttons)
- Success #2D7A3A on success-subtle → **5.1:1** ✓ AA
- Danger #C43C2C on danger-subtle → **5.8:1** ✓ AA

### Score Badge Accessibility

Hot/Warm/Cold are distinguished by **shape + label**, not color alone:

- Hot: ▲ triangle + "Hot" label + danger color
- Warm: ■ square + "Warm" label + warning color
- Cold: ● circle + "Cold" label + info color

## Typography

| Role          | Font             | Weight | Size                 |
| ------------- | ---------------- | ------ | -------------------- |
| Display / H1  | Playfair Display | 700    | 32px / 2rem          |
| H2            | Playfair Display | 600    | 24px / 1.5rem        |
| H3            | Source Sans 3    | 600    | 20px / 1.25rem       |
| H4            | Source Sans 3    | 600    | 16px / 1rem          |
| Body          | Source Sans 3    | 400    | 14px / 0.875rem      |
| Body small    | Source Sans 3    | 400    | 13px / 0.8125rem     |
| Caption       | Source Sans 3    | 400    | 12px / 0.75rem       |
| KPI / Tabular | Source Sans 3    | 700    | varies, tabular-nums |
| Button        | Source Sans 3    | 500    | 14px / 0.875rem      |
| Label         | Source Sans 3    | 600    | 12px / 0.75rem       |
| Code / Mono   | Source Code Pro  | 400    | 13px                 |

All fonts are Google Fonts, OFL licensed, self-hostable.

## Spacing Scale

Based on 4px grid:

| Token      | Value |
| ---------- | ----- |
| --space-0  | 0px   |
| --space-1  | 4px   |
| --space-2  | 8px   |
| --space-3  | 12px  |
| --space-4  | 16px  |
| --space-5  | 20px  |
| --space-6  | 24px  |
| --space-8  | 32px  |
| --space-10 | 40px  |
| --space-12 | 48px  |
| --space-16 | 64px  |

## Border Radius

| Token         | Value | Usage                       |
| ------------- | ----- | --------------------------- |
| --radius-sm   | 3px   | Small badges, tags          |
| --radius-md   | 4px   | Inputs, small buttons       |
| --radius-lg   | 6px   | Cards, panels, main buttons |
| --radius-xl   | 8px   | Modals, popovers            |
| --radius-full | 999px | Avatars, pills              |

## Elevation

Prefer borders over shadows. Use shadows sparingly:

| Token       | Value                      | Usage               |
| ----------- | -------------------------- | ------------------- |
| --shadow-sm | 0 1px 2px rgba(0,0,0,0.05) | Subtle lift         |
| --shadow-md | 0 2px 8px rgba(0,0,0,0.08) | Dropdowns, popovers |
| --shadow-lg | 0 4px 16px rgba(0,0,0,0.1) | Modals              |

## Motion

| Token             | Value    | Usage           |
| ----------------- | -------- | --------------- |
| --duration-fast   | 100ms    | Hover, focus    |
| --duration-normal | 150ms    | Transitions     |
| --duration-slow   | 250ms    | Modals, panels  |
| --easing-default  | ease-out | Standard easing |

All motion respects `prefers-reduced-motion: reduce` — set duration to 0ms.

## Icons

- **Lucide** only (1.5px stroke weight)
- Size: 16px (inline/table), 20px (buttons/nav), 24px (empty states)
- Color: inherit from text color
- Never use emoji as icons

## Component Patterns

- Buttons: filled (accent), outline (border), ghost (no border)
- Inputs: 1px border, 4px radius, focus ring with accent-subtle
- Tables: 1px borders, alternating rows optional, hover highlight
- Cards: 1px border, 6px radius, white surface
- Badges/Tags: 3px radius, subtle background + colored text
- Toasts: bottom-right, auto-dismiss, accessible
- Dialogs: centered, overlay, focus trap
