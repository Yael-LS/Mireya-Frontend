import type { SVGProps } from "react";

// Ícono del Refugio: un tulipán de trazo, del mismo estilo que los de lucide.
export default function TulipIcon({ size = 20, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 21v-8" />
      <path d="M12 13c-3.2 0-5.2-2.2-5.2-6.2L9.4 9 12 4.8 14.6 9l2.6-2.2c0 4-2 6.2-5.2 6.2z" />
      <path d="M12 18c-1.8-1.8-3.8-2.1-6-1.2M12 19c1.8-1.8 3.8-2.1 6-1.2" />
    </svg>
  );
}
