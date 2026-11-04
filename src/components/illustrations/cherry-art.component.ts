import { Component, input } from '@angular/core';
import { uid } from './illustrations.utils';

/** Cerise double stylisée */
@Component({
  selector: 'ds-cherry-art',
  host: { style: 'display: contents' },
  templateUrl: './cherry-art.component.html',
})
export class CherryArt {
  readonly size = input(48);
  readonly className = input<string>();
  readonly color = input('#E11D48');
  protected id = uid();
}
