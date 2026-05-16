/** M28 設計系統：基礎 Card 容器。 */

import type { HTMLAttributes, ReactElement } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({
  className = "",
  ...rest
}: CardProps): ReactElement {
  return (
    <div
      className={`rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_1px_0_rgba(28,26,23,0.04)] ${className}`}
      {...rest}
    />
  );
}
