import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Équivalent de l'attribut React `autoFocus` : focus à l'insertion de l'élément. */
@Directive({ selector: '[autoFocus]' })
export class AutoFocus {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => el.focus());
  }
}
