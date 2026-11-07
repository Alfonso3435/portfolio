// Categorical series colors for the Lab charts, in fixed order. Validated as a set on the
// site's dark card surface (#161b22): lightness band, CVD separation and 3:1 contrast all
// pass (dataviz skill, scripts/validate_palette.js). Text never uses these; marks do.
export const SERIES = ["#3987e5", "#d95926", "#199e70"] as const;

/** A recessive neutral for marks that are context, not the point (earlier versions). */
export const CONTEXT = "#4a5361";
