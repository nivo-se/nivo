import React from 'react';
import { cn } from '@/lib/utils';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface StaggeredContainerProps {
  children: React.ReactElement[];
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

const StaggeredContainer: React.FC<StaggeredContainerProps> = ({
  children,
  className,
  staggerDelay = 100,
  initialDelay = 0,
}) => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <div ref={ref} className={cn(className)}>
      {children.map((child, index) =>
        React.cloneElement(child, {
          key: index,
          className: cn(
            child.props.className,
            'transition-all duration-700 ease-out',
            isVisible 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-6'
          ),
          style: {
            ...child.props.style,
            transitionDelay: `${initialDelay + index * staggerDelay}ms`,
          },
        })
      )}
    </div>
  );
};

export default StaggeredContainer;