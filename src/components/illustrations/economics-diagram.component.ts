import { Component } from '@angular/core';
import { uid } from './illustrations.utils';

const ECO_BOXES = [
  { x: 10, y: 20, w: 170, t: '% fruits sains', s: 'issu de la simulation', c: '#DCFCE7' },
  { x: 10, y: 140, w: 170, t: 'Surface × rdt × prix', s: 'hypothèses éditables', c: '#DBEAFE' },
  { x: 250, y: 80, w: 160, t: 'CA stratégie', s: '− CA du témoin', c: '#FEF3C7' },
  { x: 250, y: 160, w: 160, t: 'Coûts leviers', s: 'filets, MO, intrants', c: '#FFE4E6' },
  { x: 480, y: 80, w: 220, t: 'Bilan net = CA sauvé − coûts', s: 'ROI = CA sauvé / coûts', c: '#0F172A' },
];

/** Chaîne de calcul économique */
@Component({
  selector: 'ds-economics-diagram',
  host: { style: 'display: contents' },
  templateUrl: './economics-diagram.component.html',
})
export class EconomicsDiagram {
  protected id = uid();
  protected url = `url(#${this.id})`;
  protected boxes = ECO_BOXES;
}
