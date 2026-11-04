import { Component, computed, input } from '@angular/core';
import { buildTemplate, GRID_N, type TemplateId } from '@/lib/store';
import { CELL_BG } from './grid-editor.utils';

// ------------------------------------------------------------------ Vignette de modèle
@Component({
  selector: 'ds-template-thumb',
  host: { '[attr.id]': 'null', style: 'display: contents' },
  templateUrl: './template-thumb.component.html',
})
export class TemplateThumb {
  readonly id = input.required<TemplateId>();
  readonly size = input(40);
  protected g = computed(() => buildTemplate(this.id()));
  protected bg = CELL_BG;
  protected cols = `repeat(${GRID_N}, 1fr)`;
}
