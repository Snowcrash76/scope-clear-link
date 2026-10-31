import type { HTMLAttributes } from "react";

export type BrandLogoVariant = "horizontal" | "stacked" | "mark";

interface BrandLogoProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BrandLogoVariant;
  inverse?: boolean;
}

const assets: Record<BrandLogoVariant, { light: string; dark: string }> = {
  horizontal: {
    light: "/brand/scopestream-horizontal-light.svg",
    dark: "/brand/scopestream-horizontal-dark.svg",
  },
  stacked: {
    light: "/brand/scopestream-stacked-light.svg",
    dark: "/brand/scopestream-stacked-dark.svg",
  },
  mark: {
    light: "/brand/scopestream-mark-light.svg",
    dark: "/brand/scopestream-mark-dark.svg",
  },
};

export function BrandLogo({
  variant = "horizontal",
  inverse = false,
  className,
  ...spanProps
}: BrandLogoProps) {
  const source = assets[variant];

  return (
    <span
      {...spanProps}
      role="img"
      aria-label="ScopeStream"
      className={`inline-flex shrink-0 items-center ${className ?? ""}`}
    >
      {inverse ? (
        <img src={source.dark} alt="" className="block h-auto w-full" />
      ) : (
        <>
          <img
            src={source.light}
            alt=""
            className="block h-auto w-full dark:hidden"
          />
          <img
            src={source.dark}
            alt=""
            className="hidden h-auto w-full dark:block"
          />
        </>
      )}
    </span>
  );
}
