import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface TextRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  stagger?: boolean;
}

const TextReveal: React.FC<TextRevealProps> = ({
  children,
  className,
  delay = 0,
  duration = 800,
  direction = 'up',
  stagger = false,
}) => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && textRef.current) {
      const element = textRef.current;
      
      // Split text into spans for stagger effect if enabled
      if (stagger && typeof children === 'string') {
        const words = children.split(' ');
        element.innerHTML = words
          .map((word, index) => 
            `<span class="inline-block" style="animation-delay: ${delay + index * 100}ms">${word}</span>`
          )
          .join(' ');
      }
    }
  }, [isVisible, children, delay, stagger]);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return 'translateY(30px)';
      case 'down':
        return 'translateY(-30px)';
      case 'left':
        return 'translateX(30px)';
      case 'right':
        return 'translateX(-30px)';
      default:
        return 'translateY(30px)';
    }
  };

  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <div
        ref={textRef}
        className={cn(
          'transition-all ease-out',
          isVisible 
            ? 'opacity-100 transform-none' 
            : 'opacity-0'
        )}
        style={{
          transform: isVisible ? 'none' : getTransform(),
          transitionDuration: `${duration}ms`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default TextReveal;