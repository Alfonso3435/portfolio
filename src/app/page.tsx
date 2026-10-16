import { ContactCta } from "@/components/sections/home/ContactCta";
import { ExperiencePreview } from "@/components/sections/home/ExperiencePreview";
import { FeaturedProjects } from "@/components/sections/home/FeaturedProjects";
import { Hero } from "@/components/sections/home/Hero";
import { Highlights } from "@/components/sections/home/Highlights";
import { SkillsPreview } from "@/components/sections/home/SkillsPreview";

// One section = one component. To reorder the Home page, reorder these lines.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Highlights />
      <FeaturedProjects />
      <ExperiencePreview />
      <SkillsPreview />
      <ContactCta />
    </>
  );
}
