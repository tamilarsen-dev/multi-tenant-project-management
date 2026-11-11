# Detent Design System

Version 0.2 · working draft · November 9, 2026 · owner: project author

## 1. Purpose and how to use this document

This is the single reference for how Detent looks, sounds and moves. Design and code both follow it. If code and this document disagree, the code is the truth for tokens, and this document must be updated in the same pull request.

Status tags used throughout: **Decided** (chosen by the owner), **Proposed** (a default suggested during design work, not yet reviewed), **Open** (not decided yet).

Change log: v0.2 (November 9, 2026): the owner accepted every item that was Proposed in v0.1, so they are now Decided. Numeric values (motion timings, type scale, sizes) stay open to tuning during implementation. The auth screen direction was added (section 10) and the old side-panel auth layout was removed.

## 2. Brand foundation

| Topic | Choice | Status |
| --- | --- | --- |
| Name | Detent. A detent is the mechanism that makes something click into a position. Availability (domain, app stores, WIPO and PDKI classes 9 and 42, social handles) is not yet checked. Fallback name: Snug | Decided as working name |
| One-line description | A calm workspace where cross-functional teams plan, track and finish work | Decided |
| Audience | Cross-functional teams, not only developers | Decided |
| Personality | Calm and focused, professional, with a creative identity of its own | Decided |
| Tagline | Work that clicks into place. | Decided |
| Language | English first, Indonesian added later | Decided |

**Core principle (Decided):** original in expression, conventional in operation. Colors, shapes, illustration, motion and voice are ours. Navigation, forms, drag and drop and button labels follow the conventions people already know.

**Calm structure, expressive moments (Decided).** Work surfaces (board, tables, task detail) stay clean and sparing. Personality lives in empty states, completion moments, onboarding, illustration, copy and motion.

**Deliberate non-references (Decided):** we do not imitate Notion (cream paper plus serif), Jira, Linear or other tools, and we do not use the meme characters that started this project. Referencing a product means learning why it works, then answering in our own visual language.

**Two signatures (Decided):** the joint (sections 8) and the click (section 9). If a new screen has neither, ask whether it needs one. Do not add them everywhere.

## 3. Voice and copy

- Plain language. No developer jargon in the interface.
- Calm, short, direct. Sentence case for everything, including titles and buttons.
- Buttons start with a verb: Create task, Sign in, Invite member.
- No blame in errors: say what happened and what to do next.
- A gentle, slightly literary touch is allowed in empty states and success moments, never in errors or forms.
- Never use exclamation marks in errors. Use at most one in a celebration.

**Terminology (Decided).** The API speaks in domain terms; the interface uses friendlier words.

| API term | Interface term |
| --- | --- |
| organization | Workspace |
| issue | Task |
| membership | Member |
| project | Project |

**Error copy (Decided).**

| API code | Message |
| --- | --- |
| INVALID\_CREDENTIALS | That email and password don't match. |
| EMAIL\_ALREADY\_EXISTS | An account with this email already exists. Try signing in instead. |
| VALIDATION\_ERROR | Show a message under the field that failed, naming the rule (for example: Use at least 12 characters). |

Do not reveal whether the email or the password was the wrong one.

**Empty state example (Decided).** Nothing here yet. Add your first task and watch it click into place.

**Internationalization rule (Decided).** Every interface string lives behind a translation key from day one. Never concatenate sentence fragments. Leave room for longer text: Indonesian strings often run longer than English, so layouts must not break when text grows by about a third (a rule of thumb to verify, not a measurement).

## 4. Logo

**Direction (Decided): C, the monogram d.** A solid bowl with a notch, and a stem with a small peg that sits inside the notch. It joins the name, the joint and the click in one mark.

**Wordmark (Decided):** the word detent in lowercase, Bricolage Grotesque Bold (700), letter spacing -0.02em.

**Mark construction (reference SVG, 48 by 48 grid):**

```svg
<svg viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'>
  <mask id='notch'>
    <rect width='48' height='48' fill='#fff'/>
    <rect x='29' y='23' width='8' height='10' fill='#000'/>
  </mask>
  <circle cx='20' cy='28' r='14' mask='url(#notch)' fill='currentColor'/>
  <rect x='34' y='6' width='6' height='36' rx='3' fill='currentColor'/>
  <rect x='30' y='24' width='4' height='8' fill='#8B54D4'/>
</svg>
```

| Variant | Ink | Peg |
| --- | --- | --- |
| Primary on light | #1F1E25 | #8B54D4 |
| On dark | #E7E7F0 | #A679ED |
| One color | single color | same as ink |

**Rules (Decided).** Clear space around the mark is at least half the mark height. The peg uses only the accent color or the one-color variant. Never close the gap between peg and notch, stretch the mark, rotate it, or add shadows or effects.

**Open:** a simplified variant for sizes below 24 px (wider gap, thicker peg), the favicon and app icon, and a final check that the gap stays readable at 16 px.

## 5. Color

Accent is a medium violet leaning toward orchid: not dark, not neon. Neutrals carry a faint violet tint so the whole interface feels like one family. All values below were computed in OKLCH and checked for contrast. **Status: Decided.**

**Accent ramp**

| Step | Hex |
| --- | --- |
| 50 | #F7F2FF |
| 100 | #ECE2FF |
| 200 | #D9C6FE |
| 300 | #C1A0FB |
| 400 | #A679ED |
| 500 (main) | #8B54D4 |
| 600 | #723EB5 |
| 700 | #562C8B |
| 800 | #371B5B |

**Neutral ramp**

| Step | Hex |
| --- | --- |
| 25 | #FAF9FF |
| 50 | #F3F2FB |
| 100 | #E7E7F0 |
| 200 | #D4D3DC |
| 300 | #A4A3AC |
| 400 | #717078 |
| 500 | #4D4C53 |
| 600 | #333239 |
| 700 | #1F1E25 |
| 800 | #141319 |
| 900 | #0B0A10 |

**Semantic roles.** Components use roles, never raw ramp steps, so themes can change without touching components. Light and dark are equal from the start (Decided). Dark is its own design, not an inverted copy.

| Role | Light | Dark |
| --- | --- | --- |
| bg | #FAF9FF | #141319 |
| surface | #FFFFFF | #1F1E25 |
| surface-sunken | #F3F2FB | #0B0A10 |
| border | #E7E7F0 | #333239 |
| border-strong (inputs) | #86858D | #696870 |
| text | #1F1E25 | #E7E7F0 |
| text-muted | #4D4C53 | #A4A3AC |
| accent | #8B54D4 | #A679ED |
| accent-hover | #723EB5 | #C1A0FB |
| accent-soft (background) | #ECE2FF | #371B5B |
| accent-ink (text on soft) | #562C8B | #D9C6FE |
| on-accent (text on accent) | #FFFFFF | #0B0A10 |

**Task status colors.** Status is always shown with a word, never by color alone.

| Status | Light (text on background) | Dark (text on background) |
| --- | --- | --- |
| In progress | #7D4C00 on #FFEED3 | #EDBB64 on #402900 |
| Done | #006D3D on #DAF9E7 | #78DCA9 on #003821 |
| Blocked | #923240 on #FFE6E7 | #FFA3AB on #4B1D22 |
| Info | #005A9D on #DDF3FF | #86CAFF on #0D2F4F |

Checked contrast: status pairs 5.7 to 7.9 to 1; white on accent 4.9 to 1; input borders at least 3 to 1.

## 6. Typography

| Use | Family | Status |
| --- | --- | --- |
| Headings and display | Bricolage Grotesque, weights 600 and 700 | Decided |
| Body and interface | Instrument Sans, weights 400 and 600 | Decided |
| Code and identifiers (task keys) | to be chosen | Open |

Fonts come from Google Fonts. Confirm availability and license before shipping. Fallback stack: system-ui, sans-serif.

**Scale (Decided).**

| Token | Size / line height | Family and weight |
| --- | --- | --- |
| display | 44 / 48 px | Bricolage 700 |
| h1 | 36 / 42 px | Bricolage 700 |
| h2 | 28 / 34 px | Bricolage 700 |
| h3 | 22 / 28 px | Bricolage 600 |
| body-lg | 18 / 28 px | Instrument Sans 400 |
| body | 16 / 24 px | Instrument Sans 400 |
| label | 14 / 20 px | Instrument Sans 600 |
| caption | 12 / 16 px | Instrument Sans 400 |

Use tabular figures for numbers in tables and counters. Body text never goes below 14 px; captions and pills may use 12 px.

## 7. Layout, shape and depth

- **Spacing (Decided):** 4 px base. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radius (Decided):** 10 px for controls, 14 to 16 px for cards and tiles, full for pills.
- **Breakpoints (Decided):** the framework defaults (640, 768, 1024, 1280). Auth pages use a single centered column (max 400 px) at every width; the decorative large mark scales down or hides on small screens.
- **Depth (Decided):** prefer borders over shadows. Elevation 1: 0 1px 2px rgba(20, 19, 25, 0.06). Elevation 2 (popovers, dragged cards): 0 8px 24px rgba(20, 19, 25, 0.12). In dark theme, depth comes from lighter surfaces and borders, not shadows.
- **Density (Open):** a compact mode for the board and tables.

## 8. Signature one: the joint

The joint is a small peg and notch that visibly connects related things.

- **Only real relationships:** parent and subtask, a task blocked by another, linked items. If everything is joined, nothing is special.
- **One shape, one unit:** a single notch shape, sized in multiples of 4 px. Reference size: 12 px wide with 3 px radius, 12 px visible in the gap between tiles plus 6 px seated into the notch.
- **State is shape plus text, not only color:** connected (peg seated, accent), blocked (peg offset with a visible gap, plus the word Blocked), done (peg flush, neutral or done color, plus the word Done).
- **Reuse the geometry** in logo, illustration and empty states so the product feels like one world.

## 9. Signature two: the click

The click is the moment something settles into place.

- **Where:** a card dropped into a column, a subtask checked, a status changed, a new item inserted. Not on every hover.
- **Sequence (Decided):** lift (slight scale up, elevation 2), travel, seat (settle with a 2 to 3 px overshoot, shadow collapses), rest.
- **Tokens (Decided):** fast 120 ms, base 180 ms, slow 240 ms. Standard easing cubic-bezier(0.22, 1, 0.36, 1). Click easing cubic-bezier(0.34, 1.56, 0.64, 1).
- **Performance:** animate transform and opacity only.
- **Reduced motion (required):** replace movement with an instant state change and a brief highlight.
- **Mobile:** use the same durations and curve in Flutter, plus a light haptic when an item seats. Confirm the exact haptic API when we build it.

## 10. Components

Every interactive component must define these states before it is built: default, hover, focus, active, disabled, loading and error where relevant.

| Component | Notes |
| --- | --- |
| Button | Variants: primary, secondary, ghost, danger. Height 48 px (never below 44). Radius 10. Primary uses accent with on-accent text |
| Text input | Visible label always (placeholders are not labels). Height 48 px, or a joined tile with the label inside it on auth screens. Border-strong. Correct autocomplete values (current-password on sign in, new-password on register) |
| Status pill | Word plus color pair from the status table. 12 px, full radius |
| Task tile | Surface, border, radius 14. Optional joint to parent or blocker |
| Focus ring | 2 px accent outline with 2 px offset on every focusable element |
| Others to define | Select, checkbox, avatar, menu, modal, toast, skeleton loader, board column, empty state |

**Auth screens (Decided).** Sign in and create account share one layout:

- A single centered column, 400 px wide, on the dark theme first (light version follows). The form is never pushed to one side.
- Fields are joined tiles: each tile has a notch on its top edge and an accent peg that connects it to the tile above. The submit button is the last tile.
- On focus, the peg above the focused tile seats 3 px lower (180 ms, click easing). The submit button presses down 2 px when active.
- A large tone-on-tone mark sits cropped in a corner as decoration only (hidden from assistive technology). Its peg starts slightly retracted and clicks fully into the notch while any field has focus. This uses the CSS `:has()` selector, so verify browser support for the target audience, and provide a static fallback.
- With reduced motion, all of these transitions are disabled.
- Sign in autocomplete values: email, current-password. Create account: name, email, new-password, with the 12 character rule shown under the password field.

## 11. Accessibility

- Text contrast at least 4.5 to 1 (3 to 1 for text at 24 px and above); interface components at least 3 to 1.
- Never rely on color alone. Status uses words, and relationships use shape.
- Touch targets at least 44 px. Visible keyboard focus everywhere.
- Real buttons, links, inputs and labels. Icon-only buttons need an accessible name.
- Respect reduced motion. Set the language attribute on the page and on any translated block.
- Aim: WCAG 2.2 AA as the baseline (Decided).

## 12. Implementation

Tokens live in code as CSS variables: roles change per theme, Tailwind reads the roles. Verify the exact syntax against the Tailwind v4 documentation for the version in use.

```css
@import 'tailwindcss';

:root {
  --bg: #FAF9FF;
  --surface: #FFFFFF;
  --border: #E7E7F0;
  --border-strong: #86858D;
  --text: #1F1E25;
  --text-muted: #4D4C53;
  --accent: #8B54D4;
  --accent-hover: #723EB5;
  --on-accent: #FFFFFF;
}

[data-theme='dark'] {
  --bg: #141319;
  --surface: #1F1E25;
  --border: #333239;
  --border-strong: #696870;
  --text: #E7E7F0;
  --text-muted: #A4A3AC;
  --accent: #A679ED;
  --accent-hover: #C1A0FB;
  --on-accent: #0B0A10;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-accent: var(--accent);
}
```

- **Theme switching:** follow the system setting by default, with a manual override stored per user.
- **Fonts:** load through the framework's font optimization, not a manual stylesheet link.
- **Mobile (Flutter):** build the color scheme from the same hex values and share the motion constants. A single tokens file that generates both outputs is Open.
- **Translations:** a message-key library for the web (to be chosen), and the matching mechanism in Flutter.

## 13. Governance

- Design decisions that change the brand or a token get a short ADR. Small adjustments only update this document.
- A new screen is reviewed against this checklist: roles not raw colors, all states defined, contrast checked, keyboard works, reduced motion respected, strings behind keys, signatures used with restraint.
- Version this document. Increase the minor version when tokens change.

## 14. Open decisions and what is still missing

Open decisions: name availability checks; simplified logo for small sizes; favicon, app icon and social image; code font; icon set and stroke style; illustration style (line art built from the joint geometry); empty, loading and error state designs; compact density mode; data visualization colors for charts; dark logo review; light theme versions of the auth screens; responsive behavior of the auth screens on small phones.

Typically also part of a design system, not yet started: email and notification templates, onboarding flow, responsive behavior per screen, a component library with documentation, design QA process, and a record of how handoff works between this document and the code.
