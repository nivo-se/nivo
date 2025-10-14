import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import TextReveal from './animations/TextReveal';


interface HeroProps {
  className?: string;
}

const Hero: React.FC<HeroProps> = ({ className }) => {
  return (
    <section className={cn('relative w-full overflow-hidden', className)}>
      <div className="relative w-full">
        <video 
          className="w-full h-auto"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={(e) => console.error('Video error:', e)}
          onLoadStart={() => console.log('Video load started')}
          onCanPlay={() => console.log('Video can play')}
          aria-label="Background hero video"
        >
          <source src="/uploads/nivo-hero-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo */}
          <FadeIn delay={0} duration={1000} direction="up">
            <div className="flex justify-center mb-8">
              <img 
                src="/nivo-logo-white.svg" 
                alt="Nivo Logo" 
                className="h-20 md:h-24 lg:h-32 w-auto"
              />
            </div>
          </FadeIn>
          
          <FadeIn delay={400} duration={900} direction="up">
            <p className="text-lg md:text-xl font-serif font-medium text-white/90 mb-8 leading-relaxed">
              Förvärv som skapar värde – tillväxt som består.
            </p>
          </FadeIn>
          
        </div>
      </div>
    </section>
  );
};

export default Hero;
