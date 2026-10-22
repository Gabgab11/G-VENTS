"use client";

// Opens the browser's print dialog. Choosing "Save as PDF" there gives a PDF ticket.
export default function PrintButton() {
  return (
    <button type="button" className="tk-btn" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
