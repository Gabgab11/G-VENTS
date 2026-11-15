"use client";

import { useTranslations } from "next-intl";

// Opens the browser's print dialog. Choosing "Save as PDF" there gives a PDF ticket.
export default function PrintButton() {
  const t = useTranslations("tickets.ticket");
  return (
    <button type="button" className="tk-btn" onClick={() => window.print()}>
      {t("print")}
    </button>
  );
}
