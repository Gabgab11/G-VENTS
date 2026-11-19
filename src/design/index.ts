// G-ventZ design system. Import from "@/design"; values live in ./tokens.css only.
export { cx } from "./cx";

// Actions
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/Button";
export { Link, type LinkProps } from "./components/Link";

// Status and feedback
export { Badge, type BadgeProps, type BadgeTone } from "./components/Badge";
export { Banner, type BannerProps, type BannerTone } from "./components/Banner";
export { EmptyState, type EmptyStateProps } from "./components/EmptyState";
export { ToastProvider, useToast, type ToastProviderProps, type ToastOptions, type ToastTone } from "./components/Toast";

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
export { Switch, type SwitchProps } from "./components/Switch";

// Radix primitives
export { Tabs, TabsList, TabsTrigger, TabsContent, type TabsTriggerProps } from "./components/Tabs";
export { TabLinks, TabLink, type TabLinksProps, type TabLinkProps } from "./components/TabLinks";
export { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel, type MenuItemProps } from "./components/Menu";
export { Dialog, DialogTrigger, DialogContent, DialogClose, type DialogContentProps } from "./components/Dialog";
export { Sheet, SheetTrigger, SheetContent, SheetClose, type SheetContentProps } from "./components/Sheet";
export { Tooltip, type TooltipProps } from "./components/Tooltip";
export { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "./components/Popover";
