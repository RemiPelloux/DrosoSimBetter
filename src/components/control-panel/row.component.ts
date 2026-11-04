import { Component, input } from '@angular/core';

@Component({
  selector: 'ds-row',
  host: { style: 'display: contents' },
  templateUrl: './row.component.html',
})
export class Row {
  readonly label = input.required<string>();
}
