import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  href?: string | null;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
  priority?: boolean;
  /** Mark-only crop for tight nav spaces */
  mark?: boolean;
};

const sizes = {
  sm: { w: 140, h: 93 },
  md: { w: 200, h: 133 },
  lg: { w: 320, h: 213 },
  hero: { w: 520, h: 347 },
} as const;

export function BrandLogo({
  href = "/",
  size = "md",
  className,
  priority,
  mark = false,
}: Props) {
  const dim = sizes[size];
  const src = mark ? "/brand/trail9-mark.png" : "/brand/trail9-logo.web.png";
  const img = (
    <Image
      src={src}
      alt="Trail9 — Try · Explore · Choose. Your Saree. Virtually."
      width={dim.w}
      height={dim.h}
      priority={priority}
      className={cn("h-auto w-full object-contain", className)}
    />
  );
  if (href === null) {
    return <div className={cn("inline-block", className)} style={{ maxWidth: dim.w }}>{img}</div>;
  }
  return (
    <Link href={href} className={cn("inline-block", className)} style={{ maxWidth: dim.w }} aria-label="Trail9 home">
      {img}
    </Link>
  );
}
