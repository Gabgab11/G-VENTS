import { useTranslations } from "next-intl";
import { groupSizeOf } from "@/lib/group-tickets";
import { Badge } from "@/design";
import b from "./Booking.module.css";

/**
 * A ticket type's name with its "Group of N" badge (D90) and the host's description under it.
 * Used on the booking forms and the event page.
 */
export default function TicketTypeInfo({ type, className }: { type: { name: string; groupSize?: number; description?: string | null }; className?: string }) {
  const t = useTranslations("event.order");
  const size = groupSizeOf(type);
  return (
    <span className={className ? `${b.typeInfo} ${className}` : b.typeInfo}>
      <span className={b.typeTitle}>
        <span className={b.typeName}>{type.name}</span>
        {size > 1 && <Badge tone="accent">{t("groupOf", { count: size })}</Badge>}
      </span>
      {type.description && <span className={b.typeDesc}>{type.description}</span>}
    </span>
  );
}
