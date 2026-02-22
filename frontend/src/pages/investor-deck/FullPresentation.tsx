import { Slide1 } from "./slides/Slide1";
import { Slide2 } from "./slides/Slide2";
import { Slide3 } from "./slides/Slide3";
import { Slide4 } from "./slides/Slide4";
import { Slide5 } from "./slides/Slide5";
import { Slide6 } from "./slides/Slide6";
import { Slide7 } from "./slides/Slide7";
import { Slide8 } from "./slides/Slide8";
import { Slide9 } from "./slides/Slide9";
import { Slide10 } from "./slides/Slide10";
import { Slide11 } from "./slides/Slide11";
import { Slide12 } from "./slides/Slide12";
import { Slide13 } from "./slides/Slide13";
import { Slide14 } from "./slides/Slide14";
import { Slide15 } from "./slides/Slide15";
import { Slide16 } from "./slides/Slide16";
import { Slide17 } from "./slides/Slide17";
import { Slide18 } from "./slides/Slide18";
import { Slide19 } from "./slides/Slide19";
import { Slide20 } from "./slides/Slide20";
import { Slide21 } from "./slides/Slide21";

const sections = [
  {
    id: "introduction",
    name: "Introduction",
    slides: [
      { num: 1, title: "Nordic Operational Compounder", component: Slide1 },
      { num: 2, title: "The Opportunity", component: Slide2 },
      { num: 3, title: "Investment Overview", component: Slide3 },
    ],
  },
  {
    id: "strategy",
    name: "Strategy",
    slides: [
      { num: 4, title: "Sourcing Engine", component: Slide4 },
      { num: 5, title: "From Acquisition to Compounding", component: Slide5 },
      { num: 6, title: "Pipeline", component: Slide6 },
      { num: 7, title: "Investment Model", component: Slide7 },
    ],
  },
  {
    id: "execution",
    name: "Execution",
    slides: [
      { num: 8, title: "Acquisition Criteria", component: Slide8 },
      { num: 9, title: "Value Creation Playbook", component: Slide9 },
      { num: 10, title: "The Compounding Advantage", component: Slide10 },
      { num: 11, title: "AI Enablement", component: Slide11 },
      { num: 12, title: "Team", component: Slide12 },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    slides: [
      { num: 13, title: "Fund Structure & Governance", component: Slide13 },
      { num: 14, title: "Capital Raise", component: Slide14 },
      { num: 15, title: "Investment Process", component: Slide15 },
      { num: 16, title: "Nordic Market Context", component: Slide16 },
      { num: 17, title: "Risk Factors & Mitigation", component: Slide17 },
    ],
  },
  {
    id: "team-governance",
    name: "Team & Governance",
    slides: [
      { num: 18, title: "Case Study", component: Slide18 },
      { num: 19, title: "Team", component: Slide19 },
      { num: 20, title: "Governance", component: Slide20 },
      { num: 21, title: "Exit Strategy & Returns", component: Slide21 },
    ],
  },
];

const CONTENT_PADDING = "px-6";
const CONTENT_MAX = "max-w-7xl mx-auto";

export function FullPresentation() {
  return (
    <div className="min-h-screen bg-deck-bg">
      <main>
        {sections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="scroll-mt-16">
            <div className={`bg-deck-accent text-white py-6 md:py-8 ${CONTENT_PADDING}`}>
              <div className={`${CONTENT_MAX}`}>
                <h2 className="text-lg md:text-xl font-bold tracking-tight">
                  {section.name}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  {section.slides.length} {section.slides.length === 1 ? "slide" : "slides"}
                </p>
              </div>
            </div>

            {section.slides.map((slide, index) => {
              const SlideComponent = slide.component;
              return (
                <div
                  key={slide.num}
                  id={`slide-${slide.num}`}
                  className={`scroll-mt-16 relative ${index % 2 === 0 ? "bg-deck-surface" : "bg-deck-bg"}`}
                >
                  <div className={`${CONTENT_MAX} ${CONTENT_PADDING} py-14 md:py-20`}>
                    <div className="absolute top-4 right-6 md:right-8 text-xs font-semibold text-deck-accent bg-deck-accent/10 border border-deck-accent/30 rounded px-2.5 py-1 tabular-nums">
                      Slide {slide.num}
                    </div>
                    <SlideComponent />
                  </div>

                  {index < section.slides.length - 1 && (
                    <div className={`${CONTENT_MAX} ${CONTENT_PADDING}`}>
                      <hr className="border-t border-deck-fg/10" />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        <footer className="bg-deck-fg text-white py-14 md:py-20">
          <div className={`${CONTENT_MAX} ${CONTENT_PADDING} text-center space-y-8`}>
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Ready to Learn More?
              </h2>
              <p className="text-white/80 text-sm max-w-2xl mx-auto leading-relaxed">
                Contact us to discuss investment opportunities and receive our
                detailed investment memorandum.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:invest@nivogroup.se"
                className="inline-flex items-center justify-center px-8 py-4 bg-deck-accent hover:bg-deck-accent-hover rounded-lg font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-deck-fg"
              >
                Contact Investment Team
              </a>
            </div>

            <div className="pt-8 border-t border-white/20 text-sm text-white/60 space-y-1">
              <p>© 2026 Nivo Group. All rights reserved.</p>
              <p>
                This presentation is confidential and intended solely for
                prospective investors.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
