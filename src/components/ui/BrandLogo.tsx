import React from "react";

interface BrandLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export default function BrandLogo({
  size = 32,
  className = "",
  ...props
}: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="100" height="100" rx="24" fill="#1c1917" />
      {/* 折角报刊纸身 */}
      <path
        d="M28 26C28 24.8954 28.8954 24 30 24H58L72 38V74C72 75.1046 71.1046 76 70 76H30C28.8954 76 28 75.1046 28 74V26Z"
        fill="#fafaf9"
      />
      {/* 报纸折角 */}
      <path
        d="M58 24V36C58 37.1046 58.8954 38 60 38H72L58 24Z"
        fill="#e7e5e4"
      />
      {/* 头条排版线 */}
      <rect x="36" y="47" width="28" height="4.5" rx="2.25" fill="#1c1917" />
      {/* 正文排版线 */}
      <rect x="36" y="56" width="20" height="4.5" rx="2.25" fill="#a8a29e" />
      {/* 琥珀金 RSS 信号锚点 */}
      <circle cx="64" cy="65" r="4.5" fill="#d97706" />
    </svg>
  );
}
