// =============================================================================
// Icônes SVG sur mesure — vocabulaire agronomique de DrosoSim Next
// Grille 24 × 24, trait 1,75 arrondi, couleur héritée (currentColor).
// Chaque icône marque ses parties animables par une classe `ico-*` ; les
// animations (styles.css) se déclenchent au survol d'un parent `.ico-host`
// ou quand il porte `data-on="true"`. Elles respectent prefers-reduced-motion.
// =============================================================================
import { Directive, input } from '@angular/core';


/** Propriétés communes : taille (24 par défaut), classes et titre accessible. */
@Directive({ host: { '[attr.title]': 'null' } })
export abstract class IconBase {
  readonly size = input<number | string>(24);
  readonly className = input<string>();
  readonly title = input<string>();
}
