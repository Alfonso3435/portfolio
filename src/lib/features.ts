// Launch switches. Everything behind a switch is finished and stays in the codebase; the
// switch only decides whether visitors can see it.
//
// `lab` covers the Lab page, the Ask Alfonso chat and its case study. It's off for the
// portfolio launch post; flip it to true for the Ask Alfonso / Recruiter Match post and
// every entry point comes back: the Lab tab, the header button, the home-page card, the
// footer link, the Learning path entry, /ask, /lab, /projects/ask-alfonso and the sitemap.
export const features = {
  lab: false,
} as const;

/** Projects that only exist on the site while their feature is on. */
export const hiddenProjectSlugs: ReadonlySet<string> = new Set(features.lab ? [] : ["ask-alfonso"]);
