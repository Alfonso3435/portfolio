import { ImageResponse } from "next/og";
import { awards } from "@/data/awards";
import { profile } from "@/data/profile";

// The preview card shown when the link is shared on LinkedIn, Slack, iMessage…
// Next.js renders this JSX to a PNG at build time. Child pages inherit it.
export const alt = `${profile.name} · ${profile.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = {
  bg: "#0e1116",
  surface: "#161b22",
  line: "#2a313c",
  fg: "#e8ecf1",
  muted: "#9aa4b2",
  accent: "#5b9dff",
};

export default function OpengraphImage() {
  const wins = awards
    .filter((a) => a.kind === "win")
    .sort((a, b) => b.year - a.year)
    .map((a) => `${a.placement} · ${a.event}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: colors.bg,
          color: colors.fg,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: colors.muted }}>alfonsovegasol.com</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 24, color: colors.accent, letterSpacing: 2 }}>
            CS @ UW PAUL G. ALLEN SCHOOL · AI / ML
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{profile.name}</div>
          <div style={{ display: "flex", fontSize: 32, color: colors.muted }}>
            AI/ML engineer and builder · Founder of Answr and ZapTap
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {wins.map((w) => (
            <div
              key={w}
              style={{
                display: "flex",
                fontSize: 22,
                padding: "10px 18px",
                borderRadius: 999,
                background: colors.surface,
                border: `1px solid ${colors.line}`,
                color: colors.fg,
              }}
            >
              {w}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
