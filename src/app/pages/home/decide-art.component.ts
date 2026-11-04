import { Component, computed, input } from '@angular/core';
import { Trophy } from 'lucide';
import { Sparkline } from '@/components/art';
import { Lucide } from '@/components/ui/lucide';
import type { Run } from './home.utils';

/** Mini-animation : courbes témoin vs stratégie */
@Component({
  selector: 'ds-home-decide-art',
  imports: [Sparkline, Lucide],
  host: { style: 'display: contents' },
  templateUrl: './decide-art.component.html',
})
export class DecideArt {
  readonly run = input.required<Run>();
  protected I = { Trophy };
  protected a = computed(() => this.run().base.series.map(p => Number(p['cherry_all']) || 0));
  protected b = computed(() => this.run().pbi.series.map(p => Number(p['cherry_all']) || 0));
  protected max = computed(() => Math.max(...this.a(), ...this.b(), 1));
}
