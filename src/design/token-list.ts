// Every token in tokens.css, grouped for the style guide (/style-guide). token-list.test.ts keeps this
// list and tokens.css in step: add a token there, add its name here.
export const TOKENS = {
  color: [
    "color-bg", "color-surface", "color-surface-raised", "color-border", "color-border-strong",
    "color-text", "color-text-soft", "color-text-muted",
    "color-accent", "color-on-accent", "color-accent-soft", "color-accent-text", "color-focus",
    "color-inverse", "color-on-inverse", "color-brand-z",
    "color-success", "color-success-soft", "color-warning", "color-warning-soft",
    "color-danger", "color-danger-soft", "color-info", "color-info-soft",
  ],
  tone: ["tone-coral", "tone-sun", "tone-mint", "tone-sky", "tone-rose", "tone-lilac", "tone-ink", "tone-paper"],
  type: ["display-xl", "display-lg", "heading-1", "logo", "heading-2", "heading-3", "stat", "body-lg", "body", "body-sm", "label", "caption", "eyebrow"],
  weight: ["weight-regular", "weight-medium", "weight-semibold", "weight-bold", "weight-heavy"],
  font: ["font-sans", "font-display"],
  space: ["space-1", "space-2", "space-3", "space-4", "space-5", "space-6", "space-8", "space-10", "space-12", "space-16"],
  radius: ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-full"],
  shadow: ["shadow-1", "shadow-2", "shadow-3"],
  layout: ["content-max", "gutter", "sidebar-width", "bottom-bar-height", "control-height"],
  layer: ["z-sticky", "z-header", "z-menu", "z-dialog", "z-toast"],
  motion: ["duration-fast", "duration-base", "ease-out", "grad-brand"],
} as const;

/** Every custom property name the list covers, with the type scale's size and line-height pairs. */
export function allTokenNames(): string[] {
  const { type, ...rest } = TOKENS;
  return [...Object.values(rest).flat(), ...type.flatMap((s) => [`text-${s}`, `leading-${s}`])];
}
