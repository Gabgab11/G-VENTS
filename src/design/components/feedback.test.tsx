import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { Stat } from "./Stat";
import { Avatar, initials } from "./Avatar";
import { Card, CardHeader } from "./Card";
import { PageHeader } from "./PageHeader";
import { Table, Td, Th } from "./Table";

const html = renderToStaticMarkup;

describe("Badge", () => {
  it.each(["neutral", "success", "warning", "danger", "info", "accent"] as const)("has the %s tone class", (tone) => {
    expect(html(<Badge tone={tone}>{"x"}</Badge>)).toBe(`<span class="badge ${tone}">x</span>`);
  });

  it("plain drops the dot; verified adds the check icon", () => {
    expect(html(<Badge plain>{"Free"}</Badge>)).toContain("plain");
    const v = html(<Badge verified>{"Verified"}</Badge>);
    expect(v).toContain("verified");
    expect(v).toContain("<svg");
    expect(v).toContain('aria-hidden="true"');
  });
});

describe("Banner", () => {
  it("is a status for info, success and warning", () => {
    for (const tone of ["info", "success", "warning"] as const) {
      expect(html(<Banner tone={tone} title="T" />)).toMatch(/^<div role="status"/);
    }
  });

  it("is an alert for danger", () => {
    const out = html(<Banner tone="danger" title="Payment failed">{"Try again."}</Banner>);
    expect(out).toMatch(/^<div role="alert"/);
    expect(out).toContain("Payment failed");
    expect(out).toContain("Try again.");
  });
});

describe("Stat", () => {
  it("shows label, value and an arrow with words", () => {
    const out = html(<Stat label="Revenue" value="₦120,000" delta={{ trend: "up", text: "18% vs previous 30 days" }} />);
    expect(out).toContain(">Revenue<");
    expect(out).toContain(">₦120,000<");
    expect(out).toContain('data-trend="up"');
    expect(out).toContain("<svg");
    expect(out).toContain("18% vs previous 30 days");
  });

  it("shows a context line without a delta", () => {
    const out = html(<Stat label="Guests" value="42" context="First 30 days" />);
    expect(out).toContain("First 30 days");
    expect(out).not.toContain("data-trend");
  });
});

describe("EmptyState, Card, PageHeader", () => {
  it("EmptyState renders heading, text and action", () => {
    const out = html(<EmptyState icon={<svg />} title="No guests yet" action={<a href="/x">{"Share"}</a>}>{"Share your event."}</EmptyState>);
    expect(out).toContain("<h3");
    expect(out).toContain("Share your event.");
    expect(out).toContain('href="/x"');
  });

  it("Card renders as a section with a header", () => {
    const out = html(<Card as="section"><CardHeader title="Recent orders" /></Card>);
    expect(out).toMatch(/^<section class="card">/);
    expect(out).toContain("<h2");
  });

  it("PageHeader has one h1 and actions", () => {
    const out = html(<PageHeader title="Events" subtitle="All your events" actions={<button>{"New"}</button>} />);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain("All your events");
  });
});

describe("Table and Avatar", () => {
  it("Td carries its label for phones; Th is a column header", () => {
    const out = html(
      <Table caption="Orders">
        <thead><tr><Th>{"Name"}</Th><Th numeric>{"Total"}</Th></tr></thead>
        <tbody><tr><Td label="Name">{"Ada"}</Td><Td label="Total" numeric>{"₦5,000"}</Td></tr></tbody>
      </Table>,
    );
    expect(out).toContain('<th scope="col"');
    expect(out).toContain('data-label="Total"');
    expect(out).toContain("<caption");
  });

  it("Avatar shows initials or an image", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  cher ")).toBe("C");
    expect(initials("Ọlá Àdìsá Bello")).toBe("ỌB");
    expect(html(<Avatar name="Ada Lovelace" />)).toContain('aria-label="Ada Lovelace"');
    expect(html(<Avatar name="Ada" src="/a.png" size={48} />)).toContain('alt="Ada"');
  });
});
