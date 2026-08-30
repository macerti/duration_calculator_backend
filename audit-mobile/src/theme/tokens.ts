/**
 * Semantic design tokens.
 *
 * Adapted from a general UI Visual-System principle: components should
 * consume tokens by *semantic role* (what is this, relative to what) rather
 * than picking colors/spacing independently per component. See
 * ORIENTATIONS.md "UI Visual System" for the full principle and how it maps
 * here — this file is the concrete implementation of that section.
 *
 * These values formalize the palette already in use across the app (a
 * monochrome black/white/gray base with semantic green/amber/red/blue
 * accents) — this is a naming pass, not a redesign, per the principle of
 * preserving the existing visual language rather than replacing it.
 *
 * Usage: import { colors, spacing, radius } from "../theme/tokens" and
 * reference colors.contentSecondary etc. in StyleSheet.create() calls —
 * never a raw hex value for anything this file already names.
 */

export const colors = {
  // --- Surfaces: the elevation ladder, lowest to highest ---
  surfaceBase: "#ffffff", // page background
  surfaceSunken: "#f5f5f7", // recessed areas: input backgrounds, chips, pill backgrounds
  surfaceRaised: "#f9f9fb", // cards, panels — one step up from base
  surfaceOverlay: "rgba(0,0,0,0.4)", // modal/dialog backdrop

  // --- Content: text and icon hierarchy ---
  contentPrimary: "#1c1c1e", // headings, primary values, primary button text-on-dark contexts
  contentSecondary: "#555555", // body text, labels
  contentTertiary: "#888888", // captions, meta text, placeholders' visible-but-quiet siblings
  contentQuaternary: "#999999", // the quietest still-legible tier (hints, calculated-value footnotes)
  contentDisabled: "#bbbbbb",
  contentInverse: "#ffffff", // text/icons placed on actionPrimary or other dark fills

  // --- Borders and dividers ---
  borderSubtle: "#f0f0f0", // hairline separators within a card (list row dividers)
  borderDefault: "#e2e2e5", // standard card/input borders
  borderStrong: "#1c1c1e", // emphasis borders — active/selected card, year-group accent rule

  // --- Actions ---
  actionPrimary: "#1c1c1e", // primary button fill
  actionPrimaryText: "#ffffff",
  actionSecondary: "#f0f0f0", // secondary/ghost button fill
  actionSecondaryText: "#333333",
  actionDisabled: "#bbbbbb",
  link: "#0066cc", // breadcrumb links, tappable hints (e.g. rounding-guide suggestion)

  // --- Semantic / state ---
  success: "#1a7f37",
  successSurface: "#eefaf0",
  warning: "#b7791f",
  warningSurface: "#fff8e6",
  error: "#c53030",
  errorSurface: "#fdecea",
  info: "#1c4e80",
  infoSurface: "#e7f0fb",

  // --- Focus ---
  focusRing: "#0066cc",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  pill: 20,
} as const;

export const typography = {
  // Sizes only — weight/color are still set per-role at the call site since
  // React Native StyleSheet doesn't support token composition the way a
  // real CSS-variable system would; this at least fixes the scale.
  caption: 11,
  small: 12,
  body: 13,
  bodyLarge: 14,
  subtitle: 15,
  title: 16,
  heading: 18,
  display: 22,
  hero: 28,
} as const;
