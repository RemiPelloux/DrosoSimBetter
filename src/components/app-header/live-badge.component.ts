import { Component, computed, input } from '@angular/core';
import { Loader2 } from 'lucide';
import { cn } from '@/lib/utils';
import { Lucide } from '../ui/lucide';

@Component({
  selector: 'ds-live-badge',
  imports: [Lucide],
  host: { style: 'display: contents' },
  templateUrl: './live-badge.component.html',
})
export class LiveBadge {
  readonly running = input.required<boolean>();
  readonly ms = input<number>();
  readonly source = input<{ label: string; error?: string }>();
  protected I = { Loader2 };
  protected cn = cn;
  protected remote = computed(() => { const s = this.source(); return !!s && !s.label.startsWith('Moteur local'); });
  protected fallback = computed(() => !!this.source()?.error);
  protected tone = computed(() => this.running() ? 'bg-amber-50 text-amber-700' : this.fallback() ? 'bg-orange-100 text-orange-800' : this.remote() ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-700');
  protected dot = computed(() => this.fallback() ? 'bg-orange-500' : this.remote() ? 'bg-sky-500' : 'bg-emerald-500');
  protected label = computed(() => this.fallback() ? 'Secours local' : this.remote() ? this.source()!.label.split(' · ')[0] : 'Temps réel');
}
