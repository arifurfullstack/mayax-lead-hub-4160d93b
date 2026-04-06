

## Subscription Page UI Refinement Plan

### Key Differences Between Current Implementation and Reference

Comparing the current code with the reference image, these are the gaps:

1. **Font**: Reference uses **Poppins** font family; current uses Inter. Need to import Poppins and apply it to the subscription page.
2. **Background**: Reference shows a **cinematic car dealership lot** background image at the bottom (rain-soaked cars with neon reflections). Current only has CSS gradient blobs — no photographic background.
3. **Card border glow intensity**: Reference shows much more vivid, saturated neon border glows — almost like bright neon tubes around each card. Current borders are too subtle.
4. **Card top glow**: Reference cards have a more pronounced vertical neon light beam/streak at the top edge of each card.
5. **More atmospheric neon streaks**: Reference has multiple bright horizontal neon light streaks/flares in the upper portion of the page (purple, cyan, gold).
6. **VIP "MOST POPULAR" badge**: In reference it has a distinct rounded border/outline style, positioned at top-right corner with a capsule/pill border around it.
7. **Card spacing and sizing**: Cards in reference appear slightly taller with more breathing room.
8. **Bottom atmospheric car image**: The reference clearly shows a dark, moody car lot scene at the bottom of the page — this is a key visual element.

### Implementation Plan

**File: `src/pages/Subscription.tsx`**

1. **Add Poppins font import** — add a Google Fonts `@import` or `<link>` for Poppins (weights 300-800), and apply `fontFamily: 'Poppins, sans-serif'` to the page wrapper.

2. **Add cinematic car lot background image** — use a dark, moody car dealership lot image as a background layer at the bottom portion of the page. Since we cannot use external images reliably, we will create a more intense atmospheric CSS effect with stronger neon streaks, multiple light flares, and a richer gradient composition to simulate the cinematic feel. Alternatively, source a free car lot image and place it in `src/assets/`.

3. **Intensify card border glows** — increase border opacity from ~0.4 to ~0.6, increase box-shadow outer glow from `0.1` to `0.2-0.25`, and add a second outer glow ring for the neon tube effect.

4. **Enhance top-edge card glow** — make the `::before` gradient taller and more intense (opacity from 0.12 to 0.2).

5. **Add more neon streak lines** — add 4-5 additional rotated gradient streaks in the background at varied positions, colors (cyan, purple, gold, blue), and opacities.

6. **Refine VIP "MOST POPULAR" badge** — add a rounded capsule border outline around the text to match the reference style.

7. **Strengthen hover effects** — increase translateY to -6px and make glow more dramatic on hover.

### Technical Details

- Poppins will be imported via Google Fonts CSS import in the component or added to `index.css`
- All visual changes are CSS-only in `src/pages/Subscription.tsx`
- No database or backend changes needed
- No new dependencies required

