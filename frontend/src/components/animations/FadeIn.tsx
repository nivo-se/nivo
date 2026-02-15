
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
  scale?: boolean;
}

const FadeIn: React.FC<FadeInProps> = ({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 800,
  threshold = 0.1,
  once = true,
  scale = false,
}) => {
  const { ref, isVisible } = useScrollAnimation({ 
    threshold, 
    triggerOnce: once 
  });

  const getInitialTransform = () => {
    const transforms = [];
    
    switch (direction) {
      case 'up':
        transforms.push('translateY(40px)');
        break;
      case 'down':
        transforms.push('translateY(-40px)');
        break;
      case 'left':
        transforms.push('translateX(40px)');
        break;
      case 'right':
        transforms.push('translateX(-40px)');
        break;
    }
    
    if (scale) {
      transforms.push('scale(0.95)');
    }
    
    return transforms.join(' ');
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        className={cn(
          'transition-all ease-out will-change-transform',
          isVisible 
            ? 'opacity-100 translate-y-0 translate-x-0 scale-100' 
            : 'opacity-0'
        )}
        style={{
          transform: isVisible ? 'none' : getInitialTransform(),
          transitionDuration: `${duration}ms`,
          transitionDelay: `${delay}ms`,
          transitionProperty: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default FadeIn;
