import React from 'react';
import { cn } from '@/lib/utils';
import { useParallax } from '@/hooks/useScrollAnimation';

interface ParallaxSectionProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  direction?: 'up' | 'down';
}

const ParallaxSection: React.FC<ParallaxSectionProps> = ({
  children,
  className,
  speed = 0.5,
  direction = 'up',
}) => {
  const { ref, offset } = useParallax(speed);
  
  const transform = direction === 'up' 
    ? `translateY(-${offset}px)` 
    : `translateY(${offset}px)`;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        style={{
          transform,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxSection;