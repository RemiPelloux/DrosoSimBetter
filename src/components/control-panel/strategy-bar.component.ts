import { Component, computed, signal } from '@angular/core';
import { Plus, Copy, Trash2, Pencil, Check, Lock } from 'lucide';
import { gridStore, select } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Lucide } from '../ui/lucide';
import { AutoFocus } from '../ui/autofocus';
import { IconBtn } from './icon-btn.component';

// ------------------------------------------------------------------ Barre des stratégies
@Component({
  selector: 'ds-strategy-bar',
  imports: [Lucide, IconBtn, AutoFocus],
  host: { style: 'display: contents' },
  templateUrl: './strategy-bar.component.html',
})
export class StrategyBar {
  protected I = { Lock, Plus, Check, Pencil, Copy, Trash2 };
  protected cn = cn;
  protected store = gridStore.getState();
  protected strategies = select(s => s.strategies);
  protected activeId = select(s => s.activeStrategyId);
  protected active = computed(() => this.strategies().find(s => s.id === this.activeId()));
  protected editing = signal<string | null>(null);
  protected draft = signal('');
}
