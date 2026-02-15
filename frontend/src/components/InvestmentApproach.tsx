
import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Settings, Network, TrendingUp } from 'lucide-react';

interface InvestmentApproachProps {
  className?: string;
  id?: string;
}

const InvestmentApproach: React.FC<InvestmentApproachProps> = ({ className, id }) => {
  const approachAreas = [
    {
      title: "Strategiska Förvärv",
      description: "Vi identifierar och förvärvar välskötta företag med stark marknadsposition och tillväxtpotential. Vårt fokus ligger på nordiska bolag inom stabila branscher med bevisat affärskoncept.",
      icon: "target"
    },
    {
      title: "Operativ Integration",
      description: "Efter förvärvet arbetar vi nära ledningsgruppen för att integrera verksamheten i vår företagsgrupp, samtidigt som vi respekterar företagets kultur och stärker dess konkurrenskraft.",
      icon: "settings"
    },
    {
      title: "Synergiskapande",
      description: "Vi skapar värde genom att utnyttja synergier mellan portföljbolagen - från inköpssamarbeten och kunskapsutbyte till gemensamma marknadsinitiativ och administrativa effektiviseringar.",
      icon: "network"
    },
    {
      title: "Långsiktig Utveckling",
      description: "Vårt engagemang sträcker sig långt bortom förvärvet. Vi investerar i människor, processer och teknologi för att säkerställa hållbar tillväxt och konkurrenskraft på lång sikt.",
      icon: "trending-up"
    }
  ];

  return (
    <section id={id} className={cn('py-20 bg-platinum/70', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-heading text-jetBlack mb-8 text-center">Vårt Tillvägagångssätt</h2>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 grid-gap-nivo max-w-7xl mx-auto">
          {approachAreas.map((area, index) => {
            const IconComponent = area.icon === 'target' ? Target :
                                 area.icon === 'settings' ? Settings :
                                 area.icon === 'network' ? Network : TrendingUp;

            return (
              <FadeIn key={index} delay={150 + index * 100}>
                <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-grayOlive/15">
                      <IconComponent className="h-6 w-6 text-grayOlive" />
                    </div>
                    <h3 className="text-xl font-heading font-semibold text-jetBlack">{area.title}</h3>
                    <p className="text-sm leading-relaxed text-jetBlack/75">{area.description}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default InvestmentApproach;
