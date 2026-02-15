import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import TextReveal from './animations/TextReveal';

interface HeroProps {
  className?: string;
}

const Hero: React.FC<HeroProps> = ({ className }) => {
  return (
    <section
      className={cn(
        'relative flex min-h-[100svh] w-full items-stretch overflow-hidden bg-jetBlack md:min-h-screen',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <video
          className="h-full w-full object-cover object-[50%_30%] sm:object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Bakgrundsvideo för hjältesektionen"
        >
          <source src="/uploads/nivo-hero-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent" />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-6 pb-20 pt-36 text-center sm:pt-40 md:pt-48">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-8">
          <FadeIn delay={0} duration={1000} direction="up">
            <img
              src="/nivo-logo-white.svg"
              alt="Nivo Group"
              className="h-20 w-auto sm:h-24 md:h-28"
            />
          </FadeIn>

          <FadeIn delay={300} duration={900} direction="up">
            <TextReveal delay={300} duration={1000}>
              <p className="text-balance text-base font-heading font-medium text-white/90 sm:text-lg md:text-xl">
                Förvärv som skapar värde – tillväxt som består.
              </p>
            </TextReveal>
          </FadeIn>

          <FadeIn delay={600} duration={900} direction="up">
            <p className="text-pretty text-sm text-white/80 sm:text-base md:text-lg">
              Vi investerar i nordiska kvalitetsbolag och tillför operativ expertis,
              teknologi och kapital för att accelerera hållbar tillväxt.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

export default Hero;
