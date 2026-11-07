// /resume.pdf — the approved base résumé, rendered from src/data/resume.ts at build time.
// Because it's generated (not a checked-in file), the downloadable résumé can never drift
// from the data that Hire Me Maybe tailors.

import { baseSelection } from "@/data/resume";
import { buildResume, sanitizeSelection } from "@/lib/resume/build";
import { pageCount, renderResume } from "@/lib/resume/pdf";

export const dynamic = "force-static";

export async function GET() {
  const pdf = await renderResume(buildResume(sanitizeSelection(baseSelection)));
  if (pageCount(pdf) !== 1) throw new Error("The base résumé must fit on one page");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Resume_Juan_Alfonso_Vega_Sol.pdf"',
    },
  });
}
