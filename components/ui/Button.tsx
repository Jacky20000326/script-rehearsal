/** M28 設計系統：Button / LinkButton 三變體 + 兩尺寸。 */

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactElement,
} from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const sizeClass: Record<Size, string> = {
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

const baseClass =
  "inline-flex items-center justify-center rounded-md font-medium select-none transition-[background-color,border-color,color] duration-[120ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-[3px] active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:active:translate-y-0";

function variantClass(variant: Variant): string {
  switch (variant) {
    case "primary":
      return "border border-transparent bg-[var(--accent)] text-[var(--surface-elevated)] hover:bg-[var(--accent-hover)] focus-visible:outline-[var(--focus-ring)] disabled:bg-[#D8D0BF] disabled:text-[var(--surface-elevated)]";
    case "secondary":
      return "border border-[var(--border-strong)] bg-transparent text-[var(--ink-strong)] hover:bg-[var(--surface-elevated)] hover:border-[var(--ink-muted)] focus-visible:outline-[var(--focus-ring)]";
    case "ghost":
      return "border border-transparent bg-transparent text-[var(--ink)] hover:bg-[rgba(28,26,23,0.04)] focus-visible:outline-[var(--focus-ring)]";
  }
}

type ButtonProps = {
  variant?: Variant;
  size?: Size;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    className?: string;
  };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={`${baseClass} ${sizeClass[size]} ${variantClass(variant)} ${className}`}
      {...rest}
    />
  );
}

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> & {
    className?: string;
  };

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: LinkButtonProps): ReactElement {
  return (
    <Link
      href={href}
      className={`${baseClass} ${sizeClass[size]} ${variantClass(variant)} ${className}`}
      {...rest}
    />
  );
}
