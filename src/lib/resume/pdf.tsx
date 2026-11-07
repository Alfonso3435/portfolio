// The résumé as a PDF, in the exact one-page format Alfonso approved (Carlito, navy name,
// ruled section headings). Used by `npm run build:resume` for public/resume.pdf and by
// the Hire Me Maybe API for tailored versions, so both always look identical.

import path from "node:path";
import { Document, Font, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeDoc } from "@/lib/resume/build";
import type { ResumeLink } from "@/data/resume";

const FONT_DIR = path.join(process.cwd(), "src", "lib", "resume", "fonts");
Font.register({
  family: "Carlito",
  fonts: [
    { src: path.join(FONT_DIR, "Carlito-Regular.ttf") },
    { src: path.join(FONT_DIR, "Carlito-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONT_DIR, "Carlito-Italic.ttf"), fontStyle: "italic" },
    { src: path.join(FONT_DIR, "Carlito-BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" },
  ],
});
// Never break words with hyphens: a résumé should wrap at spaces only.
Font.registerHyphenationCallback((word) => [word]);

const NAVY = "#1F3864";
const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 20, paddingHorizontal: 32, fontFamily: "Carlito", fontSize: 10.5, lineHeight: 1.16 },
  name: { fontSize: 21, lineHeight: 1.2, fontWeight: "bold", color: NAVY, textAlign: "center", marginBottom: 2 },
  contact: { textAlign: "center", fontSize: 10.5 },
  link: { color: NAVY, textDecoration: "none" },
  sectionTitle: { fontSize: 12.5, lineHeight: 1.2, fontWeight: "bold", marginTop: 7 },
  rule: { borderBottomWidth: 0.8, borderBottomColor: "#000", marginTop: 1, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 2.2 },
  rowLeft: { flex: 1, paddingRight: 8 },
  rowRight: { fontStyle: "italic", textAlign: "right" },
  bullet: { flexDirection: "row", paddingLeft: 9 },
  bulletDot: { width: 8 },
  bulletText: { flex: 1 },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
});

/** `**bold**` markers → Text runs. */
function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") ? (
      <Text key={i} style={s.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}

function LinkText({ part }: { part: ResumeLink }) {
  return part.href ? (
    <Link src={part.href} style={s.link}>
      {part.text}
    </Link>
  ) : (
    <Text>{part.text}</Text>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.rule} />
      {children}
    </View>
  );
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.rowLeft}>{left}</Text>
      {right ? <Text style={s.rowRight}>{right}</Text> : null}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

const sep = " | ";

export function ResumePdf({ doc }: { doc: ResumeDoc }) {
  return (
    <Document title={`${doc.name} — Résumé`} author={doc.name} subject="Résumé" creator="alfonsovegasol.com">
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{doc.name.toUpperCase()}</Text>
        {doc.contact.map((line, i) => (
          <Text key={i} style={s.contact}>
            {line.map((part, j) => (
              <Text key={j}>
                {j ? sep : ""}
                <LinkText part={part} />
              </Text>
            ))}
          </Text>
        ))}

        <Section title="Education">
          {doc.education.map((e) => (
            <View key={e.school}>
              <Row
                left={
                  <>
                    <Text style={s.bold}>{e.school}</Text> | <Text style={s.italic}>{e.detail}</Text>
                  </>
                }
                right={e.dates}
              />
              {e.lines.map((l) => (
                <Bullet key={l.label}>
                  <Text style={s.bold}>{l.label}:</Text> <Text style={s.italic}>{l.text}</Text>
                </Bullet>
              ))}
            </View>
          ))}
        </Section>

        <Section title="Technical Skills">
          {doc.skills.map((l) => (
            <Bullet key={l.label}>
              <Text style={s.bold}>{l.label}:</Text> {l.items.join(", ")}
            </Bullet>
          ))}
        </Section>

        <Section title="Experience">
          {doc.experience.map((x) => (
            <View key={x.id}>
              <Row
                left={
                  <>
                    <Text style={s.bold}>{x.title}</Text> |{" "}
                    {x.orgHref ? (
                      <Link src={x.orgHref} style={{ ...s.link, ...s.bold }}>
                        {x.org}
                      </Link>
                    ) : (
                      <Text style={s.bold}>{x.org}</Text>
                    )}{" "}
                    | <Text style={s.italic}>{x.dates}</Text>
                  </>
                }
                right={x.location || undefined}
              />
              {x.bullets.map((b, i) => (
                <Bullet key={i}>{rich(b)}</Bullet>
              ))}
            </View>
          ))}
        </Section>

        <Section title="Projects">
          {doc.projects.map((p) => (
            <View key={p.id}>
              <Row
                left={
                  <>
                    <Text style={s.bold}>{p.name}</Text> |{" "}
                    <Text style={s.italic}>
                      {p.subtitle} | {p.stack}
                    </Text>
                  </>
                }
                right={
                  p.right ? (
                    p.rightHref ? (
                      <Link src={p.rightHref} style={s.link}>
                        {p.right}
                      </Link>
                    ) : (
                      p.right
                    )
                  ) : undefined
                }
              />
              {p.bullets.map((b, i) => (
                <Bullet key={i}>{rich(b)}</Bullet>
              ))}
            </View>
          ))}
        </Section>
      </Page>
    </Document>
  );
}

/** Count pages in a rendered PDF (each page object is "/Type /Page"). */
export function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

export async function renderResume(doc: ResumeDoc): Promise<Buffer> {
  return renderToBuffer(<ResumePdf doc={doc} />);
}
