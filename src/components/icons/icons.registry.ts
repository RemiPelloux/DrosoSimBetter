// =============================================================================
// Icônes SVG sur mesure — vocabulaire agronomique de DrosoSim Next
// Grille 24 × 24, trait 1,75 arrondi, couleur héritée (currentColor).
// Chaque icône marque ses parties animables par une classe `ico-*` ; les
// animations (styles.css) se déclenchent au survol d'un parent `.ico-host`
// ou quand il porte `data-on="true"`. Elles respectent prefers-reduced-motion.
// =============================================================================
import { IconHygiene } from './icon-hygiene.component';
import { IconNet } from './icon-net.component';
import { IconSpray } from './icon-spray.component';
import { IconParasitoid } from './icon-parasitoid.component';
import { IconSterileMale } from './icon-sterile-male.component';
import { IconMildWinter } from './icon-mild-winter.component';
import { IconHarshWinter } from './icon-harsh-winter.component';
import { IconHumidSpring } from './icon-humid-spring.component';
import { IconHeat } from './icon-heat.component';


export const LEVER_ICONS = { prophylaxis: IconHygiene, netting: IconNet, treatment: IconSpray, parasitoids: IconParasitoid, tis: IconSterileMale } as const;
export const CLIMATE_ICONS = { 'mild-winter': IconMildWinter, 'harsh-winter': IconHarshWinter, 'humid-spring': IconHumidSpring, 'dry-summer': IconHeat } as const;
