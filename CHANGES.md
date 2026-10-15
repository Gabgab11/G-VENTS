# Home photo + create-event mirror ball (branch: feature/home-and-ball)

Paste these into the branch created from the latest `main`. Review each diff before merging.

## New files
- `public/images/disco-hero.jpg`: the disco photo used on the home page.
- `src/components/MirrorBall.tsx`: the mirror ball (canvas) and its drop.

## Changed files (replace the whole file, after checking the diff against main)
- `src/app/page.tsx`: the globe is replaced by the disco photo and a darkening layer. The text and buttons are unchanged.
- `src/app/events/new/NewEventForm.tsx`: the mirror ball is shown above the form.

## Styles
- Append the contents of `styles-append.css` to the end of `src/app/globals.css`. Do not replace the file, so your collaborator's styles are kept.

## Check before merging
1. `npm run build` passes.
2. Home page: photo shows, text and buttons are readable, phone version has no drift.
3. Create event: the ball drops and turns; the form works while it moves.
4. Reduced motion on: the ball appears still, and the photo does not move.
5. The Globe component file is left in place but is no longer used on the home page.
