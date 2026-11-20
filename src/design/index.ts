// G-ventZ design system. Import from "@/design"; values live in ./tokens.css only.
// Client-only components (Switch, Tabs, Menu, Dialog, Sheet, Tooltip, Popover, Toast) come from
// "@/design/client": a server component that imports this index must not pull them into the page.
export { cx } from "./cx";

// Actions
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/Button";
export { Link, type LinkProps } from "./components/Link";

// Status and feedback
export { Badge, type BadgeProps, type BadgeTone } from "./components/Badge";
export { Banner, type BannerProps, type BannerTone } from "./components/Banner";
export { EmptyState, type EmptyStateProps } from "./components/EmptyState";

// Containers and data
export { Card, CardHeader, type CardProps, type CardHeaderProps } from "./components/Card";
export { Stat, type StatProps, type StatTrend } from "./components/Stat";
export { PageHeader, type PageHeaderProps } from "./components/PageHeader";
export { Table, Th, Td, type TableProps, type ThProps, type TdProps } from "./components/Table";
export { Avatar, initials, type AvatarProps, type AvatarSize } from "./components/Avatar";

// Forms
export { Field, type FieldProps } from "./components/Field";
export { Input, type InputProps } from "./components/Input";
export { Textarea, type TextareaProps } from "./components/Textarea";
export { Select, type SelectProps } from "./components/Select";
export { Checkbox, type CheckboxProps } from "./components/Checkbox";

export { TabLinks, TabLink, type TabLinksProps, type TabLinkProps } from "./components/TabLinks";
