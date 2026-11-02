// =============================================================================
// Icônes SVG sur mesure — vocabulaire agronomique de DrosoSim Next
// Grille 24 × 24, trait 1,75 arrondi, couleur héritée (currentColor).
// Chaque icône marque ses parties animables par une classe `ico-*` ; les
// animations (globals.css) se déclenchent au survol d'un parent `.ico-host`
// ou quand il porte `data-on="true"`. Elles respectent prefers-reduced-motion.
// =============================================================================
import { Component, Directive, input } from '@angular/core';

// Enveloppe commune (grille 24 × 24, trait 1,75) — équivalent du composant <Svg> React.
const SVG_OPEN = `<svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
  stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" [attr.aria-hidden]="title() ? null : true" [attr.role]="title() ? 'img' : null" [attr.class]="className() || null">
  @if (title()) { <title>{{ title() }}</title> }`;

/** Propriétés communes : taille (24 par défaut), classes et titre accessible. */
@Directive({ host: { '[attr.title]': 'null' } })
abstract class IconBase {
  readonly size = input<number | string>(24);
  readonly className = input<string>();
  readonly title = input<string>();
}

/** Filet insect-proof : arceau maillé au-dessus d'un arbre */
@Component({ selector: 'ds-icon-net', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M3 13a9 9 0 0 1 18 0"></path>
      <path class="ico-mesh" d="M6.5 13V9.3M12 13V4M17.5 13V9.3M4.2 9.5h15.6M3.7 11.5h16.6" stroke-width="1" opacity="0.85"></path>
      <path d="M3 13v8M21 13v8"></path>
      <path d="M12 21v-4"></path>
      <circle cx="12" cy="14.5" r="2.6" fill="currentColor" fill-opacity="0.18"></circle>
</svg>` })
export class IconNet extends IconBase {}

/** Prophylaxie : fruits résiduels ramassés et détruits (bac fermé) */
@Component({ selector: 'ds-icon-hygiene', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M6 9h12l-.9 10.2a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8z" fill="currentColor" fill-opacity="0.14"></path>
      <path d="M4 9h16"></path>
      <path d="M9.5 9V7.5A1.5 1.5 0 0 1 11 6h2a1.5 1.5 0 0 1 1.5 1.5V9"></path>
      <circle class="ico-drop" cx="10" cy="15" r="1.7" fill="currentColor" fill-opacity="0.35"></circle>
      <circle class="ico-drop ico-drop-2" cx="14.2" cy="16.2" r="1.5" fill="currentColor" fill-opacity="0.35"></circle>
      <path d="M10.6 13.4 12 11.5M14.6 14.8 15.5 13" stroke-width="1.1" opacity="0.8"></path>
</svg>` })
export class IconHygiene extends IconBase {}

/** Traitement : lance de pulvérisation et nuage de gouttelettes */
@Component({ selector: 'ds-icon-spray', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M3 21l7.5-7.5"></path>
      <path d="M9.2 12.2l2.6 2.6" stroke-width="2.2"></path>
      <path d="M11.8 11.5c.8-.8 1.8-1.1 2.7-.8" stroke-width="1.4"></path>
      <path class="ico-dots" d="M16 6h.01M19.5 5h.01M18.5 9h.01M21 9.5h.01M17 12.5h.01M20.5 13.5h.01M15.5 3h.01" stroke-width="2.3"></path>
      <path d="M13.5 10.5c1.5-3 3.5-4.8 6-5.6" stroke-width="1" opacity="0.45"></path>
      <path d="M13.8 11.2c2.5-.7 4.8-.2 6.6 1.2" stroke-width="1" opacity="0.45"></path>
</svg>` })
export class IconSpray extends IconBase {}

/** Parasitoïde : petite guêpe (Ganaspis / Trichopria) */
@Component({ selector: 'ds-icon-parasitoid', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path class="ico-wing" d="M12 11.5c-2.5-4.5-7.5-6-9.5-4.5s1 5 5.5 6.5" fill="currentColor" fill-opacity="0.14"></path>
      <path class="ico-wing ico-wing-r" d="M12 11.5c2.5-4.5 7.5-6 9.5-4.5s-1 5-5.5 6.5" fill="currentColor" fill-opacity="0.14"></path>
      <ellipse cx="12" cy="9" rx="1.6" ry="2" fill="currentColor" fill-opacity="0.5"></ellipse>
      <path d="M12 11v2"></path>
      <path d="M12 13c-2 0-3 1.6-3 3.5S10.5 21 12 21s3-2.6 3-4.5-1-3.5-3-3.5z" fill="currentColor" fill-opacity="0.25"></path>
      <path d="M10.8 7.2 9.5 5M13.2 7.2 14.5 5" stroke-width="1.2"></path>
      <path d="M12 21v1.5" stroke-width="1.2"></path>
</svg>` })
export class IconParasitoid extends IconBase {}

/** TIS : symbole mâle irradié (mâles stériles) */
@Component({ selector: 'ds-icon-sterile-male', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <circle cx="10" cy="14" r="5.5" fill="currentColor" fill-opacity="0.14"></circle>
      <path d="M14 10l6-6M20 4h-5M20 4v5"></path>
      <path class="ico-spark" d="M4 4l1.2 1.2M3 9h1.7M8 3v1.7" stroke-width="1.4"></path>
</svg>` })
export class IconSterileMale extends IconBase {}

/** Hiver doux : soleil bas et flocon discret */
@Component({ selector: 'ds-icon-mild-winter', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <circle cx="10" cy="10" r="4" fill="currentColor" fill-opacity="0.18"></circle>
      <path class="ico-rays" d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"></path>
      <path d="M18.5 15v6M15.9 16.5l5.2 3M15.9 19.5l5.2-3" stroke-width="1.3"></path>
</svg>` })
export class IconMildWinter extends IconBase {}

/** Hiver rigoureux : grand flocon */
@Component({ selector: 'ds-icon-harsh-winter', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <g class="ico-spin">
        <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"></path>
        <path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M4.2 7.5l2.7.7M4.2 7.5l.7-2.7M19.8 16.5l-2.7-.7M19.8 16.5l-.7 2.7M4.2 16.5l.7 2.7M4.2 16.5l2.7-.7M19.8 7.5l-.7-2.7M19.8 7.5l-2.7.7" stroke-width="1.3"></path>
      </g>
</svg>` })
export class IconHarshWinter extends IconBase {}

/** Printemps humide : nuage, pluie et jeune pousse */
@Component({ selector: 'ds-icon-humid-spring', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M7 11.5a4 4 0 0 1 .5-8 5 5 0 0 1 9.4 1.5A3.3 3.3 0 0 1 17 11.5z" fill="currentColor" fill-opacity="0.14"></path>
      <path class="ico-rain" d="M9 14l-1 2.5M13 14l-1 2.5M17 14l-1 2.5" stroke-width="1.4"></path>
      <path d="M12 22v-3"></path>
      <path d="M12 19c0-1.8 1.2-3 3-3 0 1.8-1.2 3-3 3zM12 19c0-1.8-1.2-3-3-3 0 1.8 1.2 3 3 3z" fill="currentColor" fill-opacity="0.25" stroke-width="1.2"></path>
</svg>` })
export class IconHumidSpring extends IconBase {}

/** Été caniculaire : soleil et ondes de chaleur */
@Component({ selector: 'ds-icon-heat', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <circle cx="12" cy="9" r="4" fill="currentColor" fill-opacity="0.22"></circle>
      <path class="ico-rays" d="M12 2v1.6M12 14.4V16M5 9H3.4M20.6 9H19M7.1 4.1 6 3M18 15l-1.1-1.1M6 15l1.1-1.1M16.9 4.1 18 3"></path>
      <path class="ico-heat" d="M5 19.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" stroke-width="1.4"></path>
</svg>` })
export class IconHeat extends IconBase {}

/** Espace naturel : deux conifères */
@Component({ selector: 'ds-icon-forest', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M8 3 3.5 11h2L2.5 16h11l-3-5h2z" fill="currentColor" fill-opacity="0.18"></path>
      <path d="M8 16v5"></path>
      <path d="M16.5 7 13.5 12.5h1.5l-2.2 4h8.4l-2.2-4h1.5z" fill="currentColor" fill-opacity="0.18"></path>
      <path d="M16.5 16.5V21"></path>
</svg>` })
export class IconForest extends IconBase {}

/** Cerise : paire de fruits, queue et feuille */
@Component({ selector: 'ds-icon-cherry', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M9 11c-1.5-3.5-.5-7 3-9"></path>
      <path d="M12 2c3 1 5 4 5 8"></path>
      <path d="M12 2c1.5 0 3 .8 4 2.3" fill="currentColor" fill-opacity="0.25" stroke-width="1.3"></path>
      <circle cx="8" cy="15.5" r="4" fill="currentColor" fill-opacity="0.22"></circle>
      <circle cx="16" cy="14.5" r="3.5" fill="currentColor" fill-opacity="0.22"></circle>
      <path class="ico-shine" d="M6.2 14.3c.4-.7 1-1.1 1.7-1.3" stroke-width="1.2" opacity="0.8"></path>
</svg>` })
export class IconCherry extends IconBase {}

/** Drosophile stylisée (pression, simulation) */
@Component({ selector: 'ds-icon-fly', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path class="ico-wing" d="M11 11C8.5 6.5 4 5 2.8 7s1.2 5.5 7.2 6" fill="currentColor" fill-opacity="0.14"></path>
      <path class="ico-wing ico-wing-r" d="M13 11c2.5-4.5 7-6 8.2-4s-1.2 5.5-7.2 6" fill="currentColor" fill-opacity="0.14"></path>
      <ellipse cx="12" cy="13.5" rx="2.6" ry="4.2" fill="currentColor" fill-opacity="0.28"></ellipse>
      <circle cx="12" cy="8.2" r="1.7" fill="currentColor" fill-opacity="0.5"></circle>
      <path d="M10.3 5.5 11.2 7M13.7 5.5 12.8 7" stroke-width="1.2"></path>
      <path d="M9.5 15.5 7.5 17.5M14.5 15.5l2 2M9.6 12.8 7 13.2M14.4 12.8l2.6.4" stroke-width="1.1" opacity="0.8"></path>
</svg>` })
export class IconFly extends IconBase {}

/** Thermomètre et feuille : climat (rubrique) */
@Component({ selector: 'ds-icon-climate', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M9 14.5V5a2.5 2.5 0 0 1 5 0v9.5a3.5 3.5 0 1 1-5 0z"></path>
      <path d="M11.5 9v6.5" stroke-width="2.2"></path>
      <path d="M17 3c3 .5 4.5 3 4 6-3 0-5-2-4-6z" fill="currentColor" fill-opacity="0.25" stroke-width="1.3"></path>
</svg>` })
export class IconClimate extends IconBase {}

/** Panier de récolte */
@Component({ selector: 'ds-icon-harvest', host: { style: 'display: contents' }, template: SVG_OPEN + `
      <path d="M3 10h18l-1.6 9.2A2 2 0 0 1 17.4 21H6.6a2 2 0 0 1-2-1.8z" fill="currentColor" fill-opacity="0.14"></path>
      <path d="M8 10 10.5 4M16 10l-2.5-6"></path>
      <path d="M7.5 14v4M12 14v4M16.5 14v4" stroke-width="1.2" opacity="0.75"></path>
</svg>` })
export class IconHarvest extends IconBase {}

export const LEVER_ICONS = { prophylaxis: IconHygiene, netting: IconNet, treatment: IconSpray, parasitoids: IconParasitoid, tis: IconSterileMale } as const;
export const CLIMATE_ICONS = { 'mild-winter': IconMildWinter, 'harsh-winter': IconHarshWinter, 'humid-spring': IconHumidSpring, 'dry-summer': IconHeat } as const;
