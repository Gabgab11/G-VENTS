import LegalDoc, { type LegalSection } from "@/components/LegalDoc";

export const metadata = { title: "Refund policy · G-ventZ" };

const sections: LegalSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "This Refund and Cancellation Policy explains how refund requests are handled for events published through G-ventZ.",
      "Our platform provides tools for organizers to publish events, sell tickets, and manage registrations. Unless expressly stated otherwise, event organizers are responsible for delivering their events and administering event-specific refunds.",
      "This policy is subject to applicable consumer protection laws.",
    ],
  },
  {
    title: "Event-Specific Refund Policies",
    paragraphs: [
      "Each organizer must establish a refund policy for their event.",
      "The applicable policy should be displayed before a ticket purchase and may specify:",
    ],
    bullets: [
      "Whether tickets are refundable.",
      "The deadline for requesting a refund.",
      "Whether cancellations are eligible for full or partial refunds.",
      "Whether tickets can be transferred to another person.",
      "Any permitted administrative deductions.",
      "How to submit a refund request.",
    ],
    after: [
      "Attendees should review the event's refund policy before completing a purchase.",
      "No event-specific policy may override mandatory rights under applicable law.",
    ],
  },
  {
    title: "Attendee-Initiated Refund Requests",
    paragraphs: [
      "If an attendee can no longer attend an event, they should contact the organizer or submit a refund request through the available platform tools.",
      "Refund eligibility will be assessed under the published event policy and applicable law.",
      "Unless the event policy or applicable law provides otherwise, organizers may decline voluntary refund requests for reasons such as a change of personal plans or failure to attend.",
    ],
  },
  {
    title: "Cancelled Events",
    paragraphs: [
      "If an organizer cancels an event, the organizer must notify affected attendees promptly.",
      "Where a refund is required by law or the applicable event policy, the organizer must arrange the appropriate refund.",
      "Any legally required refund must not be denied solely because an event's policy states that tickets are non-refundable.",
    ],
  },
  {
    title: "Postponed or Rescheduled Events",
    paragraphs: [
      "If an event is postponed or rescheduled, the organizer must inform ticket holders of the new arrangements.",
      "Refund eligibility will depend on the event policy and applicable law, including any rights triggered by a material change to the event.",
    ],
  },
  {
    title: "Duplicate or Incorrect Payments",
    paragraphs: [
      "If you believe you were charged more than once for the same order or charged incorrectly, contact support with your order reference and relevant transaction details.",
      "We will investigate the issue and coordinate with the organizer or payment provider as appropriate.",
      "Verified duplicate charges will be addressed in accordance with applicable payment rules and law.",
    ],
  },
  {
    title: "Processing Refunds",
    paragraphs: [
      "Approved refunds will generally be returned through the original payment method where supported.",
      "The time required for the funds to appear in your account depends on the payment provider and your financial institution.",
      "We will communicate any material delay or additional information required to process the refund.",
    ],
  },
  {
    title: "Platform and Processing Fees",
    paragraphs: [
      "Any platform or payment processing fees associated with a refund will be handled according to the fee terms disclosed at checkout, the applicable payment provider's rules, and applicable law.",
      "We will not retain or deduct fees where doing so would violate mandatory legal requirements.",
    ],
  },
  {
    title: "Subscription Refunds",
    paragraphs: [
      "Fees paid for optional organizer subscriptions are generally non-refundable once the relevant billing period has begun, except where required by law or where we determine that a refund is appropriate because of a billing error or another exceptional circumstance.",
      "Cancelling a subscription stops future renewals but does not automatically refund previous payments.",
    ],
  },
  {
    title: "Fraud and Unauthorized Transactions",
    paragraphs: [
      "If you suspect that a ticket purchase or payment was unauthorized, contact us promptly.",
      "We may request relevant transaction information and coordinate with the payment provider to investigate.",
      "Nothing in this section limits any rights you may have under applicable payment or consumer protection laws.",
    ],
  },
  {
    title: "How to Request a Refund",
    paragraphs: [
      "Contact the event organizer using the contact information on the event page.",
      "For payment-processing issues, duplicate charges, or platform-related problems, contact:",
      "Support Email: support@gventz.com",
      "Please include your order reference, event name, purchase date, and a description of the issue. Do not send your full payment card number or security code.",
    ],
  },
  {
    title: "Policy Updates",
    paragraphs: [
      "We may update this policy from time to time. The effective date will be revised when changes are published.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "Platform: G-ventZ",
      "Email: support@gventz.com",
    ],
  },
];

export default function RefundsPage() {
  return <LegalDoc title="Refund and Cancellation Policy" effective="October 15, 2026" sections={sections} />;
}
