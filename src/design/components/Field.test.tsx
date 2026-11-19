import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { Switch } from "./Switch";

const attr = (html: string, tag: string, name: string) => html.match(new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`))?.[1];

describe("Field", () => {
  it("links the label to the control with a generated id", () => {
    const out = renderToStaticMarkup(<Field label="Event name"><Input /></Field>);
    const id = attr(out, "input", "id");
    expect(id).toBeTruthy();
    expect(attr(out, "label", "for")).toBe(id);
    expect(out).not.toContain("aria-invalid");
    expect(out).not.toContain("aria-describedby");
  });

  it("uses the given id", () => {
    const out = renderToStaticMarkup(<Field label="Email" id="email"><Input type="email" /></Field>);
    expect(attr(out, "label", "for")).toBe("email");
    expect(attr(out, "input", "id")).toBe("email");
  });

  it("describes the control by its hint and error and marks it invalid", () => {
    const out = renderToStaticMarkup(
      <Field label="Capacity" id="cap" hint="Leave empty for no limit" error="Must be a whole number">
        <Input aria-describedby="extra" />
      </Field>,
    );
    expect(attr(out, "input", "aria-describedby")).toBe("extra cap-hint cap-error");
    expect(attr(out, "input", "aria-invalid")).toBe("true");
    expect(out).toContain('id="cap-hint"');
    expect(out).toContain('id="cap-error"');
  });

  it("only the hint when there is no error", () => {
    const out = renderToStaticMarkup(<Field label="Bio" id="bio" hint="Optional"><Textarea /></Field>);
    expect(attr(out, "textarea", "aria-describedby")).toBe("bio-hint");
    expect(out).not.toContain("aria-invalid");
  });

  it("passes required through and shows the marker", () => {
    const out = renderToStaticMarkup(<Field label="Currency" id="cur" required><Select><option>{"NGN"}</option></Select></Field>);
    expect(out).toMatch(/<select[^>]*required=""/);
    expect(attr(out, "select", "id")).toBe("cur");
  });

  it("wires a Switch too", () => {
    const out = renderToStaticMarkup(<Field label="Public" id="pub" error="Required"><Switch /></Field>);
    expect(attr(out, "button", "id")).toBe("pub");
    expect(attr(out, "button", "aria-invalid")).toBe("true");
  });
});

describe("Switch", () => {
  it("is a switch, off by default", () => {
    const out = renderToStaticMarkup(<Switch aria-label="Public" />);
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="false"');
    expect(out).toContain('type="button"');
  });

  it("reflects defaultChecked and checked", () => {
    expect(renderToStaticMarkup(<Switch aria-label="a" defaultChecked />)).toContain('aria-checked="true"');
    expect(renderToStaticMarkup(<Switch aria-label="a" checked={false} defaultChecked />)).toContain('aria-checked="false"');
  });

  it("submits a hidden input when named and on", () => {
    expect(renderToStaticMarkup(<Switch aria-label="a" name="public" defaultChecked />)).toContain('<input type="hidden" name="public" value="on"/>');
    expect(renderToStaticMarkup(<Switch aria-label="a" name="public" />)).not.toContain("<input");
  });
});

describe("Checkbox", () => {
  it("wraps a native checkbox in its label", () => {
    const out = renderToStaticMarkup(<Checkbox label="Remember me" name="r" defaultChecked />);
    expect(out).toMatch(/^<label[^>]*><input[^>]*type="checkbox"/);
    expect(out).toContain('checked=""');
  });
});
