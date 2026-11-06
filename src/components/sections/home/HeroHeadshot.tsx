import Image from "next/image";
import { profile } from "@/data/profile";

/**
 * Circular headshot for the hero: the photo sits inside a thin ring with a soft accent
 * glow behind it. Until `profile.headshot` is set it shows his initials, so the layout
 * never has a hole or a broken image.
 */
export function HeroHeadshot() {
  const initials = profile.name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="order-first flex flex-[0_1_auto] justify-center lg:order-none lg:flex-[0_1_320px]">
      <div className="relative isolate">
        <div aria-hidden="true" className="absolute inset-4 -z-10 rounded-full bg-accent-soft blur-2xl" />
        <div className="rounded-full border border-line bg-bg p-2 sm:p-2.5">
          <div className="relative size-40 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line sm:size-56 lg:size-72">
            {profile.headshot ? (
              <Image
                src={profile.headshot}
                alt={`Headshot of ${profile.name}`}
                fill
                sizes="(min-width: 1024px) 288px, (min-width: 640px) 224px, 160px"
                preload
                className="object-cover object-top"
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center font-display text-5xl font-bold tracking-tight text-muted sm:text-6xl"
              >
                {initials}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
