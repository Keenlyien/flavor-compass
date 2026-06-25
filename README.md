# Digital Chef

> International recipe discovery with step-by-step walkthroughs and local ingredient cost estimates.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Animations | Motion + GSAP |
| Icons | Lucide React |
| Fonts | Cormorant Garamond, Courier Prime, DM Sans |
| Theme | Custom CSS variable system (light/dark) |

## Project Structure

```
app/
  layout.tsx                    ← Root layout, font imports, ThemeProvider
  page.tsx                      ← Home page (Navbar + Hero)
  globals.css                   ← Design token system (CSS vars, animations)
components/
  layout/
    Navbar.tsx                  ← Fixed navigation with theme toggle
  home/
    Hero.tsx                    ← Hero section (full viewport)
  ui/
    ThemeProvider.tsx           ← Light/dark theme context
lib/
  utils.ts                      ← cn() utility for Tailwind class merging
```

## Design Tokens

All colors are CSS variables defined in `globals.css`:
- `--bg-primary/secondary/card/surface` — backgrounds
- `--accent-warm/rose/dark` — accent colors
- `--text-primary/secondary/muted/inverse` — typography
- `--border / --border-strong` — borders

## Color Palette

| Token | Light | Dark |
|---|---|---|
| bg-primary | `#F5EFE6` | `#1A1410` |
| bg-card | `#EAD9C8` | `#2C231B` |
| accent-warm | `#C8A882` | `#C8A882` |
| text-primary | `#1C1814` | `#F2EAE0` |

## Next Steps (Pages to Build)

- [ ] Recipe Discovery — `/recipes`
- [ ] Recipe Detail — `/recipes/[id]`
- [ ] Step-by-Step Walkthrough — `/recipes/[id]/cook`
- [ ] IP-based cost estimation — `/api/location` + `lib/prices.json`
- [ ] Spoonacular API integration — `lib/spoonacular.ts`
