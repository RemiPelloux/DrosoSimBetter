import { Component, input } from '@angular/core';
import type { TextSpec } from './chartkit.utils';

// ---------------------------------------------------------------- Composants SVG partagés
@Component({
  selector: 'g[dsText]',
  templateUrl: './svg-text.component.html',
})
export class SvgText {
  readonly dsText = input.required<TextSpec>();
}
