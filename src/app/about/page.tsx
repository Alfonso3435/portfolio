import type { Metadata } from "next";
import { AboutIntro } from "@/components/sections/about/AboutIntro";
import { EducationList } from "@/components/sections/about/EducationList";
import { ExperienceTimeline } from "@/components/sections/about/ExperienceTimeline";
import { LearningPath } from "@/components/sections/about/LearningPath";
import { Recognition } from "@/components/sections/about/Recognition";
import { SkillsGrid } from "@/components/sections/about/SkillsGrid";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "About",
  description: "Experience, education, awards, skills and learning path of Juan Alfonso Vega Sol.",
};

export default function AboutPage() {
  return (
    <Container className="flex flex-col gap-20 py-16 pb-24">
      <AboutIntro />
      <ExperienceTimeline />
      <EducationList />
      <Recognition />
      <SkillsGrid />
      <LearningPath />
    </Container>
  );
}
