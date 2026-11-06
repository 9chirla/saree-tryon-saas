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
      className="h-auto w-full object-contain"
    />
  );
  const shell = cn(
    "inline-block overflow-hidden rounded-2xl bg-[#FFF9EF]/90 shadow-[0_8px_30px_rgba(66,16,92,0.08)] ring-1 ring-[rgba(217,154,34,0.35)]",
    className,
  );
  if (href === null) {
    return (
      <div className={shell} style={{ maxWidth: dim.w }}>
        {img}
      </div>
    );
  }
  return (
    <Link href={href} className={shell} style={{ maxWidth: dim.w }} aria-label="Trail9 home">
      {img}
    </Link>
  );
}
