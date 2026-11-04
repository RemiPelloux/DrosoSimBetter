import { Component, input } from '@angular/core';
import { cn } from '@/lib/utils';
import { Motion } from '../ui/motion';

/**
 * En-tête de chapitre éditorial.
 * Titre simple : [title]="'…'" ; titre riche : contenu projeté avec l'attribut `chapterTitle`.
 */
@Component({
  selector: 'ds-chapter',
  imports: [Motion],
  host: { '[attr.title]': 'null', '[attr.id]': 'null', style: 'display: contents' },
  templateUrl: './chapter.component.html',
})
export class Chapter {
  readonly id = input.required<string>();
  readonly n = input.required<string>();
  readonly kicker = input.required<string>();
  readonly title = input<string>('');
  readonly className = input<string>();
  protected cn = cn;
}
