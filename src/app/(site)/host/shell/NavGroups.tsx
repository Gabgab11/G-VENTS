"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { NavIcon } from "./icons";
import { HREF, currentKey, panelGroups, rowCount, type HostCounts, type RowCount } from "./nav";
import styles from "./NavGroups.module.css";

/** The words for a row's count ("3 waiting", "Action needed"). */
export function useCountText() {
  const t = useTranslations("host.shell.count");
  return (c: RowCount) => (c.kind === "action" ? t("action") : t(c.kind, { count: c.n }));
}

/**
 * The grouped list of host pages (FR-36.2) with counts at the end of each row. The desktop panel and
 * the phone's More sheet both use it, so the two always match.
 */
export default function NavGroups({ pathname, isStaff, counts, onNavigate }: {
  pathname: string;
  isStaff: boolean;
  counts: HostCounts;
  onNavigate?: () => void;
}) {
  const t = useTranslations("host.shell");
  const countText = useCountText();
  const groups = panelGroups(isStaff);
  const current = currentKey(pathname, groups.flatMap((g) => g.items));
  return (
    <div className={styles.groups}>
      {groups.map((g) => (
        <div key={g.key} role="group" aria-labelledby={`host-nav-${g.key}`} className={styles.group}>
          <p id={`host-nav-${g.key}`} className={styles.label}>{t(`groups.${g.key}`)}</p>
          <ul className={styles.list}>
            {g.items.map((k) => {
              const c = rowCount(k, counts);
              return (
                <li key={k}>
                  <Link href={HREF[k]} className={styles.row} aria-current={k === current ? "page" : undefined} onClick={onNavigate}>
                    <NavIcon name={k} />
                    <span className={styles.name}>{t(k)}</span>
                    {c && <span className={styles.count} data-urgent={c.urgent || undefined}>{countText(c)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
