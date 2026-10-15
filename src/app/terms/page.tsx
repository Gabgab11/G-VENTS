import LegalDoc, { type LegalSection } from "@/components/LegalDoc";

export const metadata = { title: "Terms of use · G-ventZ" };

const sections: LegalSection[] = [
  {
    title: "Introduction",
    paragraphs: [
      "Welcome to G-ventZ.",
      "These Terms of Service govern your access to and use of our website, applications, event management tools, ticketing services, and related features.",
      "G-ventZ provides a platform that enables users to create, publish, discover, manage, and promote events, register attendees, and sell tickets.",
      "By creating an account or using our services, you agree to these Terms. If you do not agree, you must discontinue using the platform.",
    ],
  },
  {
    title: "Eligibility and Accounts",
    paragraphs: [
      "You must have the legal capacity to enter into a binding agreement to use our services.",
      "You agree to:",
    ],
    bullets: [
      "Provide accurate and complete registration information.",
      "Keep your login credentials secure.",
      "Maintain accurate information about your events.",
      "Notify us promptly of unauthorized access to your account.",
      "Accept responsibility for activities conducted through your account, subject to applicable law.",
    ],
    after: ["We reserve the right to restrict or suspend accounts that violate these Terms."],
  },
  {
    title: "Event Organizers",
    paragraphs: [
      "Event organizers are responsible for the events they publish and manage through our platform.",
      "Organizers must:",
    ],
    bullets: [
      "Provide accurate event descriptions, dates, locations, schedules, and ticket prices.",
      "Obtain all permits, licenses, and authorizations required for their events.",
      "Ensure their events comply with applicable laws.",
      "Clearly disclose event-specific rules and refund conditions.",
      "Deliver the events and services advertised to attendees.",
      "Handle attendee inquiries, complaints, cancellations, and applicable refunds.",
      "Avoid misleading advertising, fraudulent ticket sales, and unauthorized use of intellectual property.",
    ],
    after: ["Organizers must not use the platform to facilitate illegal activities, fraudulent transactions, or prohibited events."],
  },
  {
    title: "Attendees and Ticket Purchases",
    paragraphs: [
      "Attendees are responsible for reviewing event information before purchasing tickets.",
      "A ticket purchase creates a transaction between the attendee and the relevant event organizer, subject to the applicable payment arrangements and consumer protection laws.",
      "Tickets may be subject to event-specific restrictions, admission conditions, identification requirements, or transfer limitations.",
      "We do not guarantee admission where an attendee violates an event's published entry requirements.",
    ],
  },
  {
    title: "Platform Fees and Payments",
    paragraphs: [
      "Creating an account and publishing free events may be available without charge.",
      "Paid ticket sales may attract platform fees, payment processing charges, subscription fees, or other clearly disclosed charges.",
      "Applicable fees will be presented before the relevant transaction is completed.",
      "Payment processing may be provided by third-party payment service providers. Their terms and policies may also apply.",
      "Organizers are responsible for ensuring their payment and payout information is accurate and for complying with applicable tax and reporting obligations.",
      "We may update our pricing with reasonable notice. Changes will not retroactively alter fees already charged on completed transactions.",
    ],
  },
  {
    title: "Payouts",
    paragraphs: [
      "Ticket proceeds will be paid to eligible organizers according to the applicable payout schedule and payment provider requirements.",
      "Payouts may be delayed where additional verification is required, a transaction is disputed, fraud is suspected, a refund is pending, or applicable law requires a restriction.",
      "We may maintain reasonable reserves where permitted by law and our payment processing agreements.",
      "We will not intentionally withhold funds without a legitimate contractual, legal, security, or payment-processing reason.",
    ],
  },
  {
    title: "Cancellations and Refunds",
    paragraphs: [
      "Event organizers must clearly disclose their refund policy before attendees purchase tickets.",
      "Refund requests will be handled according to the event's published policy, these Terms, and applicable law.",
      "If an event is cancelled, the organizer must communicate the cancellation promptly and issue refunds where required by law or the applicable event policy.",
      "Refunds may take several business days to appear, depending on the payment provider and the attendee's financial institution.",
      "Platform fees and payment processing fees will be treated according to the applicable fee disclosure, payment provider rules, and legal requirements.",
      "Nothing in this section removes any mandatory refund or consumer rights available under applicable law.",
    ],
  },
  {
    title: "Prohibited Activities",
    paragraphs: ["You may not:"],
    bullets: [
      "Create fraudulent or misleading events.",
      "Sell counterfeit, unauthorized, or invalid tickets.",
      "Manipulate ticket sales or payment systems.",
      "Circumvent platform fees or security controls.",
      "Collect personal information unlawfully.",
      "Send unsolicited marketing communications in violation of applicable law.",
      "Upload malicious software or attempt unauthorized access to our systems.",
      "Infringe another person's intellectual property.",
      "Use the platform for unlawful discrimination, harassment, fraud, or other prohibited conduct.",
    ],
    after: ["We may remove content, cancel listings, restrict features, or suspend accounts where reasonably necessary to enforce these Terms or comply with the law."],
  },
  {
    title: "Intellectual Property",
    paragraphs: [
      "You retain ownership of the content you own and upload to the platform.",
      "By publishing event content, you grant G-ventZ a limited, non-exclusive, worldwide, royalty-free license to host, reproduce, display, and distribute that content as reasonably necessary to operate, promote, and provide the services you request.",
      "You represent that you have the rights and permissions necessary to upload and use your content.",
      "Our software, branding, interface, and original platform materials remain our property or the property of our licensors.",
    ],
  },
  {
    title: "Privacy",
    paragraphs: [
      "Our collection and use of personal information are governed by our Privacy Policy.",
      "Organizers must process attendee information lawfully and use it only for permitted event administration, communications, and other disclosed purposes.",
      "Organizers must obtain any consent required before using attendee information for unrelated marketing.",
    ],
  },
  {
    title: "Third-Party Services",
    paragraphs: [
      "Our platform may integrate with payment processors, analytics providers, email services, identity verification tools, and other third-party services.",
      "We are not responsible for independent third-party services beyond the responsibilities imposed on us by applicable law or our agreements with those providers.",
      "Your use of those services may be subject to additional terms.",
    ],
  },
  {
    title: "Service Availability",
    paragraphs: [
      "We aim to provide a reliable service but do not guarantee uninterrupted access.",
      "Maintenance, technical issues, security incidents, or circumstances beyond our reasonable control may temporarily affect availability.",
      "We will take reasonable steps to restore affected services.",
    ],
  },
  {
    title: "Limitation of Liability",
    paragraphs: [
      "To the extent permitted by applicable law, G-ventZ is not responsible for losses arising solely from an organizer's failure to deliver an event, inaccurate event information supplied by an organizer, or disputes between organizers and attendees.",
      "Nothing in these Terms excludes liability that cannot legally be excluded, including applicable consumer rights and liability for fraud or intentional misconduct.",
      "Any other limitation of liability will apply only to the extent permitted by applicable law.",
    ],
  },
  {
    title: "Account Suspension and Termination",
    paragraphs: [
      "You may stop using the platform at any time.",
      "We may suspend or terminate access where you materially breach these Terms, engage in fraud, create a security risk, or where suspension is necessary to comply with law.",
      "Where reasonably possible, we will explain the reason for suspension and provide an opportunity to resolve the issue.",
      "Outstanding payment, refund, and legal obligations may survive termination.",
    ],
  },
  {
    title: "Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time.",
      "Material changes will be communicated through the platform, by email, or through another appropriate method.",
      "The revised Terms will state their effective date.",
    ],
  },
  {
    title: "Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of Nigeria, subject to mandatory legal protections applicable to users.",
      "Any dispute will be handled by the competent courts or dispute resolution bodies determined under applicable law.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "For questions about these Terms, contact:",
      "Platform: G-ventZ",
      "Email: support@gventz.com",
    ],
  },
];

export default function TermsPage() {
  return <LegalDoc title="Terms of Service" effective="October 15, 2026" sections={sections} />;
}
