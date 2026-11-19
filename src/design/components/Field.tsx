import { CircleAlert } from "lucide-react";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Field.module.css";

type ControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** The error message; sets aria-invalid on the control. */
  error?: ReactNode;
  required?: boolean;
  /** The control's id; generated when omitted (or taken from the child's own id). */
  id?: string;
  className?: string;
  /** Exactly one control: Input, Textarea, Select, Switch or a native element. */
  children: ReactElement<ControlProps>;
};

/** A visible label, an optional hint and error, wired to its one child control. */
export function Field({ label, hint, error, required, id, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? children.props.id ?? `field-${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        required: required ?? children.props.required,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {required ? <span className={styles.required} aria-hidden>{"*"}</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
