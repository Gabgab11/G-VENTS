import LegalDoc, { type LegalSection } from "@/components/LegalDoc";

export const metadata = { title: "Privacy Policy · G-ventZ" };

// PLACEHOLDER: section outline only. Replace each "To be written" paragraph with the reviewed
// policy text and set the effective date before paid tickets launch.
const TODO = "To be written.";

const sections: LegalSection[] = [
  { title: "Introduction", paragraphs: ["This Privacy Policy will explain how G-ventZ collects, uses and protects your personal information when you use our website, apps and ticketing services.", TODO] },
  { title: "Information We Collect", paragraphs: [TODO], bullets: ["Account details (name, email address)", "Event and registration details", "Tickets and check-in records", "Device and usage information"] },
  { title: "How We Use Your Information", paragraphs: [TODO] },
  { title: "Sharing With Event Hosts", paragraphs: [TODO] },
  { title: "Third-Party Services", paragraphs: [TODO] },
  { title: "Cookies and Local Storage", paragraphs: [TODO] },
  { title: "Data Retention", paragraphs: [TODO] },
  { title: "Your Rights", paragraphs: [TODO] },
  { title: "Security", paragraphs: [TODO] },
  { title: "Children", paragraphs: [TODO] },
  { title: "Changes to This Policy", paragraphs: [TODO] },
  { title: "Contact Us", paragraphs: [TODO] },
];

export default function Page() {
  return <LegalDoc title="Privacy Policy" effective="To be confirmed" intro="This policy is being drafted. The full text will be published before paid tickets launch." sections={sections} />;
}
