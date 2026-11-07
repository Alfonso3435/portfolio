import type { ResumeSelection } from "@/data/resume";
import { buildResume, shorten } from "@/lib/resume/build";
import { pageCount, renderResume } from "@/lib/resume/pdf";

/** Render the selection, trimming the weakest content until it fits on one page. */
export async function renderOnePage(selection: ResumeSelection): Promise<{ pdf: Buffer; selection: ResumeSelection }> {
  let current = selection;
  for (let attempt = 0; attempt < 24; attempt++) {
    const pdf = await renderResume(buildResume(current));
    if (pageCount(pdf) <= 1) return { pdf, selection: current };
    const next = shorten(current);
    if (!next) return { pdf, selection: current };
    current = next;
  }
  throw new Error("Couldn't fit the résumé on one page");
}
