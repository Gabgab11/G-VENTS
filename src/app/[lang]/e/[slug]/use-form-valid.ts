"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Whether the booking form's own constraints (required fields, the agreement tick) are met, so the
 * confirm button can stay disabled until they are. Checked after each render and on every input;
 * the server action still validates everything.
 */
export function useFormValid() {
  const ref = useRef<HTMLFormElement>(null);
  const [valid, setValid] = useState(false);
  const check = useCallback(() => setValid(ref.current?.checkValidity() ?? false), []);
  useEffect(check);
  return { ref, valid, check };
}
