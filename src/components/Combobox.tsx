"use client";

import { useId, useMemo, useRef, useState } from "react";
import { fold } from "@/lib/locations";

export type ComboOption = { value: string; label: string };

// A searchable dropdown that looks like the site's other inputs.
// Type to filter, arrow keys to move, Enter to pick, Escape to close.
// The chosen value is posted through a hidden input named `name`.
export default function Combobox({
  name,
  label,
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
}: {
  name: string;
  label: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const matches = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);

  function show() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(option: ComboOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function move(delta: number) {
    if (!open) return show();
    if (matches.length === 0) return;
    const next = (active + delta + matches.length) % matches.length;
    setActive(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && open) {
      e.preventDefault(); // pick, don't submit the form
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="combo">
        <input
          className="input combo-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : selected?.label ?? ""}
          onFocus={show}
          onClick={() => { if (!open) show(); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
        />
        <span className="combo-caret" aria-hidden>▾</span>
        {open && (
          <ul className="combo-list" id={listId} role="listbox" ref={listRef}>
            {matches.length === 0 && <li className="combo-empty">{emptyText}</li>}
            {matches.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`combo-opt ${i === active ? "active" : ""}`}
                // mousedown, not click: runs before the input's blur closes the list
                onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                onMouseEnter={() => setActive(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name={name} value={value} />
    </label>
  );
}
