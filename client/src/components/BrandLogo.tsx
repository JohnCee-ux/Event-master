import React from 'react';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imageClassName = '',
}) => (
  <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1d1e22] ${className}`}>
    <img
      src="/gatekeeper-logo.jpg"
      alt="GateKeeper"
      className={`h-full w-full object-cover ${imageClassName}`}
    />
  </span>
);
