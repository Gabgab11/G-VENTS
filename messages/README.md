# Messages (Change 3)

Every user-visible word on the website lives here, one folder per language, one file per area.
English (`en/`) is the source and the fallback. The admin dashboard stays English and isn't here (D69).

## Areas
| Area | Covers |
|---|---|
| `common` | header, navigation, account menu, language switcher |
| `errors` | API error codes (`errors.order.sold_out`) |
| `shared` | shared components, error/not-found/loading pages, payment wording, sign-in codes, categories, dashboard notices |
| `home` | home page and its footer |
| `discover` | discover page |
| `event` | event page, registering, paying, waiting list |
| `tickets` | ticket page, orders, my tickets |
| `auth` | sign-in, sign-up, unsubscribe, offline |
| `dashboard` | host dashboard, event dashboard tabs, scanner and check-in |
| `createEvent` | creating and editing events (form, location, time zone, ticket types, fees) |
| `account` | two-step sign-in and passkeys, payouts |
| `info` | pricing, help |
| `legal` | terms, privacy, refunds |

`src/i18n/messages.ts` lists the areas and which ones browser components receive per layout.

## Writing code
- **Server components:** `const t = await getTranslations("area")`. On public pages (under `src/app/[lang]/`), call `setRequestLocale(lang)` first (from `params`), so the page stays static per language.
- **Client components:** `const t = useTranslations("area")`.
- **Ids:** dotted lowerCamel paths, grouped by screen or component: `event.register.button`, `dashboard.guests.empty`.
- **Placeholders:** `"Hello {name}"` → `t("x", { name })`. **Plurals:** `"{count, plural, one {# ticket} other {# tickets}}"`.
- **Links and bold inside a sentence:** `t.rich("x", { link: (c) => <Link href="/terms">{c}</Link> })` with `"Read the <link>terms</link>."`.
- **Dates, times, prices:** `useFormat()` (client) or `await getFormat()` (server) from `src/i18n/`. Never put a formatted date or price inside a message; pass it as a placeholder.
- **Never translated:** hosts' content (titles, descriptions, ticket names, questions, announcements, refund policies), brand names, and values stored in the database (category values, codes). Category *labels* are translated (`categoryLabelKey(category)` → `shared.categories.music`).
- **Lint:** `react/jsx-no-literals` refuses new text in components; `eslint.i18n-pending.mjs` lists files not moved over yet.

## Translations
- Machine first drafts follow `glossary.md`. Every language must have exactly English's ids, placeholders, tags and valid plural forms (`src/i18n/messages.test.ts`).
- After changing English, run `npm run i18n:sync`. Missing messages are copied in English and listed in `{lang}/_pending.json` until translated.
- **Native-speaker review before release (D76):** reviewers correct the JSON (or an exported sheet), and their sign-off is recorded in `aidlc-docs`.
