import type { ProjectVideo as ProjectVideoData } from "@/lib/types";

/**
 * One video in a case study. Files play from /public with a poster frame;
 * YouTube videos use the privacy-friendly youtube-nocookie domain and load lazily.
 */
export function ProjectVideo({ video }: { video: ProjectVideoData }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
        {video.kind === "youtube" ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        ) : (
          <video
            src={video.src}
            poster={video.poster}
            controls
            playsInline
            preload="none"
            // Short silent clips behave like a GIF; longer videos wait for the visitor.
            {...(video.loop ? { autoPlay: true, muted: true, loop: true } : {})}
            className="max-h-[70vh] w-full bg-black object-contain"
          />
        )}
      </div>
      <figcaption className="text-sm text-muted">
        {video.title}
        {video.kind === "file" && video.credit ? ` · ${video.credit}` : ""}
      </figcaption>
    </figure>
  );
}
