# G-ventZ design system

Components and tokens for every G-ventZ screen (Change 4, FR-28).

## Import

```tsx
import { Button, Card, CardHeader, Field, Input } from "@/design";
```

Each component is `src/design/components/X.tsx` with its own `X.module.css`. Components with state,
context or Radix are client components (`"use client"`); the rest also render in server components.

## The token rule

`src/design/tokens.css` is the only place values live. Component CSS uses its custom properties
(`--color-*`, `--space-*`, `--radius-*`, `--text-*`/`--leading-*`, `--weight-*`, `--shadow-*`, `--z-*`,
`--duration-*`, `--ease-out`, `--control-height`, `--font-sans`, `--font-display`).

- No hex/rgb/hsl colours, px font sizes or px radii in component CSS. px is fine for 1px/2px borders,
  icon sizes and layout widths.
- Logical properties only (`inline-start/end`, `inset-inline`, `text-align: start`), so Arabic mirrors.
  `node scripts/logical-css.mjs --check <files>` checks this.
- Icons: `lucide-react`, 20px (16px in small buttons and badges), `strokeWidth={1.75}`, `aria-hidden`.
- User-visible text comes from the caller (translated); components hold none, except the default
  `closeLabel="Close"` on Dialog, Sheet and ToastProvider, which callers should pass translated.
- `src/design/contrast.test.ts` checks every text/ground pair in both themes; change a colour and run it.

## Components

Actions
- `Button`: pill; `variant` primary | accent | secondary | ghost | danger, `size` sm | md | lg, `icon` (icon-only circle, needs `aria-label`), `loading`, `fullWidth`, `href` renders a link.
- `Link`: inline text link in the accent colour; Next `Link` inside, `<a>` for external URLs.

Status and feedback
- `Badge`: pill label with a dot; `tone` neutral | success | warning | danger | info | accent, `plain` (no dot), `verified` (check icon).
- `Banner`: page message with an icon, `title`, one sentence, optional `action`; `tone` info | success | warning | danger (danger is `role="alert"`).
- `EmptyState`: `icon`, `title`, sentence, `action` for an empty list.
- `ToastProvider` + `useToast()`: mount the provider once; `toast({ title, description?, tone? })`.

Containers and data
- `Card` / `CardHeader`: bordered surface (`as` div | section | article); header with `title` and an optional `action`.
- `Stat`: `label`, `value`, `delta={{ trend, text }}` (arrow plus words) or `context`.
- `PageHeader`: the page `h1` in the display face, `subtitle`, `actions`.
- `Table`, `Th`, `Td`: semantic table; under 640px rows stack as cards labelled by `Td label`.
- `Avatar`: `name` (initials and alt text), optional `src`, `size` 28 | 36 | 48.

Forms
- `Field`: `label`, `hint`, `error`, `required`; wires `id`, `aria-describedby` and `aria-invalid` into its one child control.
- `Input`, `Textarea`, `Select` (native, with a chevron): 44px, 16px text, strong edge, focus ring.
- `Checkbox`: native checkbox with its `label`; the row is a 44px target.
- `Switch`: `role="switch"`; `checked`/`onCheckedChange` or `defaultChecked`; `name` submits a hidden input.

Radix primitives
- `Tabs`, `TabsList`, `TabsTrigger` (`count`), `TabsContent`: underlined tabs.
- `TabLinks` + `TabLink` (`href`, `active`, `count`): route tabs with `aria-current="page"`, same look.
- `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem` (`danger`), `MenuSeparator`, `MenuLabel`: dropdown menu.
- `Dialog`, `DialogTrigger`, `DialogContent` (`title`, `description`, `footer`, `closeLabel`), `DialogClose`.
- `Sheet`, `SheetTrigger`, `SheetContent`, `SheetClose`: bottom sheet under 640px, dialog above; same API as Dialog.
- `Tooltip`: `<Tooltip content="…"><Button …/></Tooltip>`; has its own provider.
- `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverClose`.
