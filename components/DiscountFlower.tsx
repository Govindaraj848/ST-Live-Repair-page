import React from 'react';

interface DiscountFlowerProps {
  discount: number | string;
  type?: string;
  className?: string;
}

export const DiscountFlower: React.FC<DiscountFlowerProps> = ({ discount, type, className = "w-6 h-6" }) => {
  const d = Number(discount);
  const t = type?.toLowerCase() || '';

  let color = '#94a3b8'; // default gray

  if (d === 30 && t === 'silver') {
    color = '#0000ff'; // Blue
  } else if (d === 30) {
    color = '#2e7d32'; // Green
  } else if (d === 20) {
    color = '#ffeb3b'; // Yellow
  } else if (d === 40) {
    color = '#f44336'; // Red
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill={color}>
        <circle cx="50" cy="20" r="18" />
        <circle cx="76" cy="35" r="18" />
        <circle cx="76" cy="65" r="18" />
        <circle cx="50" cy="80" r="18" />
        <circle cx="24" cy="65" r="18" />
        <circle cx="24" cy="35" r="18" />
        <circle cx="50" cy="50" r="20" />
      </g>
      <circle cx="50" cy="50" r="14" fill="#e5e7eb" />
    </svg>
  );
};
