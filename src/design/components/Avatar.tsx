import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./Avatar.module.css";

export type AvatarSize = 28 | 36 | 48;

export type AvatarProps = Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** The person's name: used for initials and the image's alt text. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
};

/** Up to two initials from a name ("Ada Lovelace" → "AL"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((w) => Array.from(w)[0]?.toLocaleUpperCase() ?? "").join("");
}

/** A round avatar: the image when there is one, otherwise initials. */
export function Avatar({ name, src, size = 36, className, ...rest }: AvatarProps) {
  return (
    <span {...rest} className={cx(styles.avatar, styles[`s${size}`], className)}>
      {src ? (
        // A plain img: avatars come from arbitrary hosts and are tiny.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.image} src={src} alt={name} width={size} height={size} />
      ) : (
        <span role="img" aria-label={name}>
          <span aria-hidden>{initials(name)}</span>
        </span>
      )}
    </span>
  );
}
