import NextLink from "next/link";
import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./Link.module.css";

export type LinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & { href: string };

const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

/** Inline text link in the accent colour; Next `Link` for internal paths, `<a>` for external ones. */
export function Link({ href, className, ...rest }: LinkProps) {
  const classes = cx(styles.link, className);
  return isExternal(href) ? <a href={href} className={classes} {...rest} /> : <NextLink href={href} className={classes} {...rest} />;
}
