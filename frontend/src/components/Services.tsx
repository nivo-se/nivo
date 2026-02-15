import React from 'react';
import { cn } from '@/lib/utils';
import StaggeredContainer from './animations/StaggeredContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Zap, TrendingUp, Users } from 'lucide-react';

interface ServicesProps {
  className?: string;
  id?: string;
}

const Services: React.FC<ServicesProps> = ({ className, id }) => {
  const services = [
    {
      title: "Operativ optimering",
      description: "Vi erbjuder skräddarsytt operationellt stöd efter varje företags specifika behov, med expertis inom processoptimering, kostnadseffektivisering, strategisk utveckling och AI-implementation.",
      icon: Settings
    },
    {
      title: "Digital acceleration",
      description: "Effektivisering genom teknologi är en central del av vår strategi. Vi erbjuder dessutom datadrivna marknadsföringstjänster, utformade för att accelerera tillväxt genom bland annat CRM-, SEO- och konverteringsoptimering.",
      icon: Zap
    },
    {
      title: "Expansionskapital",
      description: "Långsiktigt och fritt kapital för att driva tillväxt och lönsamhet genom till exempel internationell expansion, produktionseffektivisering, produktutveckling och företagsförvärv.",
      icon: TrendingUp
    },
    {
      title: "Rekrytering",
      description: "Vårt omfattande nätverk fungerar som en katalysator för tillväxt. Vi erbjuder rekryteringstjänster, från interimslösningar och konsulter till erfarna ledare och styrelsemedlemmar.",
      icon: Users
    }
  ];

  return (
    <section id={id} className={cn('py-16 md:py-24 bg-white', className)}>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <StaggeredContainer
          staggerDelay={150}
          className="grid grid-gap-nivo max-w-6xl mx-auto px-2 sm:px-4 md:grid-cols-2"
        >
          {services.map((service, index) => {
            const IconComponent = service.icon;

            return (
              <Card
                key={index}
                className="group h-full border-grayOlive/20 bg-white/90 transition-transform duration-500 hover:-translate-y-1 hover:shadow-2xl"
              >
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-grayOlive/15 transition-transform duration-300 group-hover:scale-105">
                      <IconComponent className="h-6 w-6 text-grayOlive" />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-heading font-semibold text-jetBlack sm:text-xl">
                        {service.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-jetBlack/75 sm:text-base">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </StaggeredContainer>
      </div>
    </section>
  );
};

export default Services;