// Custom red pill-shaped call end icon (Google Meet style - phone handset)
export const CallEndIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Phone handset receiver */}
    <path d="M 6.62 10.79 C 8.06 13.62 10.38 15.94 13.21 17.38 L 15.41 15.18 C 15.69 14.9 16.08 14.82 16.43 14.93 C 17.55 15.3 18.75 15.5 20 15.5 C 20.55 15.5 21 15.95 21 16.5 L 21 20 C 21 20.55 20.55 21 20 21 C 10.61 21 3 13.39 3 4 C 3 3.45 3.45 3 4 3 L 7.5 3 C 8.05 3 8.5 3.45 8.5 4 C 8.5 5.25 8.7 6.45 9.07 7.57 C 9.18 7.92 9.1 8.31 8.82 8.59 L 6.62 10.79 Z" />
  </svg>
);


