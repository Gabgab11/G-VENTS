"use client";

import { useEffect } from "react";
import { recordAuthFloor } from "@/lib/auth-floor";

// Records the back-button floor on the first page after signing in (src/lib/auth-floor.ts).
export default function AuthFloor() {
  useEffect(() => recordAuthFloor(window.history.length), []);
  return null;
}
