"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderCircle, Mic, X, type LucideIcon } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <Mic size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span>
        vyapaar
        <span className="brand-voice">
          voice<span className="brand-dot">.</span>
        </span>
      </span>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoaderCircle size={17} className="spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Alert({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`alert ${success ? "alert-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  closeLabel,
  onClose,
  busy = false,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <div>
            <h2 id="modal-heading">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={closeLabel}
            onClick={onClose}
            disabled={busy}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
