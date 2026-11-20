import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Link } from "./Link";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const icon = <svg data-testid="i" />;

describe("Button", () => {
  it("renders a type=button with the variant and size classes", () => {
    const out = html(<Button variant="accent" size="lg">{"Register"}</Button>);
    expect(out).toMatch(/^<button type="button"/);
    expect(out).toContain("button");
    expect(out).toMatch(/class="[^"]*\baccent\b[^"]*\blg\b/);
  });

  it("defaults to secondary md", () => {
    expect(html(<Button>{"Save"}</Button>)).toMatch(/class="button secondary md"/);
  });

  it.each(["primary", "accent", "secondary", "ghost", "danger"] as const)("has the %s variant class", (variant) => {
    expect(html(<Button variant={variant}>{"Go"}</Button>)).toContain(` ${variant} `);
  });

  it.each(["sm", "md", "lg"] as const)("has the %s size class", (size) => {
    expect(html(<Button size={size}>{"Go"}</Button>)).toMatch(new RegExp(`class="[^"]*\\b${size}\\b`));
  });

  it("renders an internal href as a Next link (anchor)", () => {
    const out = html(<Button href="/host/events">{"Events"}</Button>);
    expect(out).toMatch(/^<a /);
    expect(out).toContain('href="/host/events"');
    expect(out).not.toContain("<button");
  });

  it("renders an external href as a plain anchor", () => {
    const out = html(<Button href="https://example.com" target="_blank" rel="noreferrer">{"Docs"}</Button>);
    expect(out).toMatch(/^<a href="https:\/\/example.com"/);
    expect(out).toContain('target="_blank"');
  });

  it("icon-only: a circle with its aria-label", () => {
    const out = html(<Button icon={icon} aria-label="Share" variant="ghost" />);
    expect(out).toContain('aria-label="Share"');
    expect(out).toMatch(/class="[^"]*\bicon\b/);
  });

  it("icon-only without aria-label is a type error", () => {
    // @ts-expect-error aria-label is required with icon
    const el = <Button icon={icon} />;
    expect(el).toBeTruthy();
  });

  it("loading sets aria-busy and disables", () => {
    const out = html(<Button loading>{"Saving…"}</Button>);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('disabled=""');
    expect(out).toContain("spinner");
  });

  it("a loading or disabled link has no href and is aria-disabled", () => {
    const out = html(<Button href="/x" disabled>{"Go"}</Button>);
    expect(out).toContain('aria-disabled="true"');
    expect(out).not.toContain("href=");
  });

  it("fullWidth adds its class and forwards rest props", () => {
    const out = html(<Button fullWidth data-x="1" type="submit">{"Send"}</Button>);
    expect(out).toContain("fullWidth");
    expect(out).toContain('data-x="1"');
    expect(out).toContain('type="submit"');
  });
});

describe("Link", () => {
  it("renders internal and external links with the link class", () => {
    expect(html(<Link href="/about">{"About"}</Link>)).toMatch(/<a class="link" href="\/about">/);
    expect(html(<Link href="https://x.org">{"X"}</Link>)).toContain('href="https://x.org"');
  });
});
