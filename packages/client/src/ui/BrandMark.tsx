import type { HTMLAttributes } from "react";

type BrandMarkProps = HTMLAttributes<HTMLSpanElement>;

/** Shared GAMVerse icon asset for navigation, authentication, and loading states. */
export function BrandMark({ className = "brand-mark", ...props }: BrandMarkProps) {
  return <span {...props} className={className} aria-hidden="true"><img className="brand-mark-image" src="/favicon.svg?v=20261103-11" alt="" /></span>;
}
