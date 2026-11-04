import { Component, input } from '@angular/core';
import { Motion } from '../ui/motion';
import { Drosophila } from './drosophila.component';

const FLY_PATHS = [
  { x: ['0%', '30%', '62%', '90%', '45%', '0%'], y: ['20%', '5%', '30%', '15%', '60%', '20%'], d: 18 },
  { x: ['85%', '60%', '20%', '10%', '55%', '85%'], y: ['70%', '85%', '60%', '30%', '40%', '70%'], d: 22 },
  { x: ['40%', '70%', '80%', '35%', '15%', '40%'], y: ['90%', '65%', '35%', '20%', '75%', '90%'], d: 26 },
  { x: ['10%', '25%', '55%', '75%', '50%', '10%'], y: ['50%', '80%', '90%', '55%', '10%', '50%'], d: 20 },
  { x: ['70%', '95%', '75%', '40%', '60%', '70%'], y: ['10%', '45%', '75%', '50%', '20%', '10%'], d: 24 },
].map(p => ({ ...p, target: { left: p.x, top: p.y, rotate: [0, 25, -20, 15, -10, 0] }, transition: { duration: p.d, repeat: 1e9, ease: 'easeInOut' } }));

/** Essaim de drosophiles qui volent sur des trajectoires organiques */
@Component({
  selector: 'ds-flying-flies',
  imports: [Motion, Drosophila],
  host: { style: 'display: contents' },
  templateUrl: './flying-flies.component.html',
})
export class FlyingFlies {
  readonly count = input(5);
  readonly className = input<string>();
  protected paths = () => FLY_PATHS;
}
