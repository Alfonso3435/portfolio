// Launch switches. Everything behind a switch is finished and stays in the codebase; the
// switch only decides whether visitors can see it.
//
// `lab` covers Ask Alfonso: the /ask tab (chat + how it works), the home-page card, the
// footer link, the Learning path entry, /projects/ask-alfonso and the sitemap entry.
export const features = {
  lab: true,
} as const;

/** Projects that only exist on the site while their feature is on. */
export const hiddenProjectSlugs: ReadonlySet<string> = new Set(features.lab ? [] : ["ask-alfonso"]);
