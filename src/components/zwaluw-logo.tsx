export function ZwaluwLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Stylized swallow (zwaluw) bird silhouette */}
      <circle cx="24" cy="24" r="23" stroke="#68b0a6" strokeWidth="2" fill="none" />
      <path
        d="M12 28C14 24 18 20 24 18C26 17.5 28 17.5 30 18C32 18.5 34 20 36 24C34 22 32 21 30 21C28 21 26 22 24 24C22 26 20 28 18 29C16 30 14 29.5 12 28Z"
        fill="#68b0a6"
      />
      <path
        d="M24 18C22 16 20 15 18 15C16 15 14 16 13 17"
        stroke="#68b0a6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M30 18C32 16 34 14.5 36 14"
        stroke="#68b0a6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="21" r="1" fill="#f7a247" />
    </svg>
  );
}
