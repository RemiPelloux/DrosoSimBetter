// =============================================================================
// Mini-moteur de graphiques SVG — reproduit le rendu de Recharts 3 (marges,
// axes, graduations « nice », grilles, étiquettes, info-bulles, légendes) pour
// les graphiques de DrosoSim Next, sans dépendre de React.
// Les algorithmes (graduations, masquage des graduations qui se chevauchent,
// position des barres, coupure des étiquettes) sont portés de Recharts 3.10.
// =============================================================================
export { textWidth, startDy, niceTicks, autoDomain, linear, preserveEnd, allTicks, cartesianLabel, rectPath, barPositions, ChartBase, inBox, nearestIndex } from './chartkit.utils';
export type { Box, Margin, Anchor, TickItem, TextSpec } from './chartkit.utils';
export { SvgAxis } from './svg-axis.component';
export type { AxisSpec } from './svg-axis.component';
export { SvgText } from './svg-text.component';
export { SvgGrid } from './svg-grid.component';
export { ChartTooltip } from './chart-tooltip.component';
export { DefaultTooltip } from './default-tooltip.component';
export type { TipItem } from './default-tooltip.component';
