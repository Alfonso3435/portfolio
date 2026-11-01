// Exports everything in src/data to ml/data/knowledge.json.
//
// This is the bridge between the website (TypeScript) and Ask Alfonso (Python):
// the site and the model read the exact same facts, so they can never disagree.
// Run it every time you change a file in src/data:  npm run export:knowledge
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { awards } from "../src/data/awards";
import { certifications } from "../src/data/certifications";
import { experience } from "../src/data/experience";
import { profile } from "../src/data/profile";
import { projects } from "../src/data/projects";
import { skillGroups } from "../src/data/skills";

const outFile = join(process.cwd(), "ml", "data", "knowledge.json");

const knowledge = {
  // Bump when the shape of this file changes, so the Python side can check it.
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  profile,
  experience,
  // Media paths are site-only details; the model doesn't need them.
  projects: projects.map((project) => {
    const rest = { ...project };
    delete rest.images;
    delete rest.videos;
    return rest;
  }),
  awards,
  skillGroups,
  certifications,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");

console.log(
  `Exported ${projects.length} projects, ${experience.length} roles, ${awards.length} awards, ` +
    `${skillGroups.length} skill groups and ${certifications.length} certifications → ml/data/knowledge.json`,
);
