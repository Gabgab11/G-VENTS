import NextLink from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A request is running: shows a spinner, sets aria-busy and disables the control. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/** Icon-only: a circle. The accessible name is required. */
type IconOnly = { icon: ReactNode; "aria-label": string; children?: never };
type Labelled = { icon?: never; children: ReactNode; "aria-label"?: string };

type AsButton = Omit<ComponentPropsWithRef<"button">, keyof Common | "children" | "aria-label"> & { href?: undefined };
type AsLink = Omit<ComponentPropsWithRef<"a">, keyof Common | "children" | "aria-label" | "href"> & {
  href: string;
  disabled?: boolean;
};

export type ButtonProps = Common & (IconOnly | Labelled) & (AsButton | AsLink);

const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

/** Pill button in five variants and three sizes; renders a link when given `href`. */
export function Button(props: ButtonProps) {
  const { variant = "secondary", size = "md", loading = false, fullWidth = false, className, icon, children, ...rest } = props;

  if (process.env.NODE_ENV !== "production" && icon && !rest["aria-label"] && !rest["aria-labelledby"]) {
    console.warn("Button: an icon-only button needs an aria-label.");
  }

  const classes = cx(
    styles.button,
    styles[variant],
    styles[size],
    icon ? styles.icon : undefined,
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  );
  const content = (
    <>
      {loading ? <LoaderCircle className={styles.spinner} size={size === "sm" ? 16 : 20} strokeWidth={1.75} aria-hidden /> : null}
      {icon ?? children}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, disabled, ...anchor } = rest as AsLink;
    const shared = { ...anchor, className: classes, "aria-busy": loading || undefined };
    if (disabled || loading) {
      // A disabled link has no href, so it can't be followed or focused (no event handler needed,
      // which keeps Button usable from server components).
      const { onClick: _onClick, ...inert } = shared;
      void _onClick;
      return (
        <a {...inert} role="link" aria-disabled="true">
          {content}
        </a>
      );
    }
    // External addresses and downloads (a file, not a page: no client navigation, no prefetch).
    if (isExternal(href) || anchor.download !== undefined) {
      return (
        <a href={href} {...shared}>
          {content}
        </a>
      );
    }
    return (
      <NextLink href={href} {...shared}>
        {content}
      </NextLink>
    );
  }

  const { type = "button", disabled, ...button } = rest as AsButton;
  return (
    <button {...button} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {content}
    </button>
  );
}
