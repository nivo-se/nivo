
import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import TextReveal from './animations/TextReveal';

interface ManifestoProps {
  className?: string;
  id?: string;
}

const Manifesto: React.FC<ManifestoProps> = ({ className, id }) => {
  return (
    <section id={id} className={cn('py-20 bg-white', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn delay={100} direction="up">
            <span className="text-sm md:text-base font-medium text-grayOlive mb-2 inline-block text-center block">Om oss</span>
          </FadeIn>
          <TextReveal delay={200} duration={1000}>
            <h2 className="text-3xl md:text-4xl font-heading text-jetBlack mb-10 text-center">Med djup erfarenhet driver Nivo hållbar tillväxt</h2>
          </TextReveal>

          <FadeIn delay={400} duration={900} direction="up">
            <p className="text-lg leading-relaxed mb-8 text-center text-jetBlack/85">
              Vi är ett team med omfattande erfarenhet inom entreprenörskap, investeringar och företagsledning som arbetar med företagare för att skapa hållbara och konkurrenskraftiga företag.
            </p>
          </FadeIn>

          <FadeIn delay={600} duration={900} direction="up">
            <p className="text-lg leading-relaxed text-jetBlack/75 text-center">
              Med erfarenhet från att ha byggt några av Sveriges snabbast växande och mest lönsamma företag, har vi djup förståelse för vad som skapar framgång. Det handlar inte om fler strategiska presentationer, utan om att stödja målmedvetna entreprenörer som har produkter som möter marknadens behov och en förmåga att anpassa sig till en snabbt föränderlig omvärld.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

export default Manifesto;

