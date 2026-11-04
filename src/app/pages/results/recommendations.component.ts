import { Component, computed, input } from '@angular/core';
import { Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide';
import { fmtEur, THRESHOLD } from '@/components/charts';
import { Lucide } from '@/components/ui/lucide';
import { Motion } from '@/components/ui/motion';
import { select, type Parcel } from '@/lib/store';
import { isCherry, PHENOLOGY, type StrategyResult } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { Card } from './card.component';

/** Texte de recommandation : segments, `b` = en gras. */
type Rec = { tone: 'good' | 'warn' | 'info'; parts: { t: string; b?: boolean }[] };
const B = (t: string) => ({ t, b: true });
const T = (t: string) => ({ t });

@Component({
  selector: 'ds-recommendations',
  imports: [Card, Motion, Lucide],
  host: { style: 'display: contents' },
  templateUrl: './recommendations.component.html',
})
export class Recommendations {
  readonly results = input.required<StrategyResult[]>();
  readonly base = input.required<StrategyResult>();
  readonly parcels = input.required<Parcel[]>();
  private strategies = select(s => s.strategies);
  protected I = { Lightbulb };
  protected TONE_ICON = { good: CheckCircle2, warn: AlertTriangle, info: Lightbulb };
  protected C = { good: 'text-emerald-600 bg-emerald-50', warn: 'text-amber-600 bg-amber-50', info: 'text-blue-600 bg-blue-50' };
  protected cn = cn;

  protected recs = computed(() => {
    const results = this.results(), base = this.base(), parcels = this.parcels(), strategies = this.strategies();
    const recs: Rec[] = [];
    const strats = results.filter(r => !r.isBaseline);
    const cherry = parcels.filter(p => isCherry(p.type));
    // parcelles les plus exposées dans le témoin
    const worst = [...cherry].sort((a, b) => (base.harvestByParcel[a.id] ?? 100) - (base.harvestByParcel[b.id] ?? 100))[0];
    if (worst && (base.harvestByParcel[worst.id] ?? 100) < 85)
      recs.push({ tone: 'warn', parts: [T('Sans protection, '), B(worst.name), T(' ne conserve que '), B(`${base.harvestByParcel[worst.id]?.toFixed(0)} %`), T(` de sa récolte : c'est la parcelle prioritaire (${isCherry(worst.type) ? PHENOLOGY[worst.type].label.toLowerCase() : ''}, mûre quand la population atteint son pic).`)] });
    const early = cherry.filter(p => p.type === 'early-cherry' && (base.harvestByParcel[p.id] ?? 0) > 90);
    if (early.length) recs.push({ tone: 'info', parts: [T(`Les variétés précoces (${early.map(p => p.name).join(', ')}) sont récoltées avant l'explosion estivale : une protection légère suffit souvent.`)] });
    if (strats.length) {
      const byNet = [...strats].sort((a, b) => (b.revenue - b.totalCost) - (a.revenue - a.totalCost));
      const top = byNet[0];
      const topNet = top.revenue - base.revenue - top.totalCost;
      const hasLevers = parcels.some(p => { const l = strategies.find(s => s.id === top.id)?.leversByParcel[p.id]; return l && (l.netting || l.prophylaxis || l.treatment || l.parasitoids || l.tis); });
      if (!hasLevers) recs.push({ tone: 'info', parts: [B(top.name), T(" n'active aucun levier : ses résultats sont identiques au témoin. Ajoutez un filet, une prophylaxie ou un traitement depuis l'éditeur.")] });
      else if (strats.length === 1) recs.push({ tone: topNet >= 0 ? 'good' : 'warn', parts: [B(top.name), T(` dégage un bilan de ${fmtEur(topNet)} / an par rapport au témoin${topNet >= 0 ? '' : ' : les leviers coûtent plus que la récolte sauvée'}.`)] });
      else recs.push({ tone: 'good', parts: [B(top.name), T(` offre le meilleur bilan économique (${fmtEur(topNet)} / an vs témoin).`)] });
      const green = [...strats].sort((a, b) => a.ift - b.ift || b.globalHarvest - a.globalHarvest)[0];
      if (green.id !== top.id && green.ift < top.ift) recs.push({ tone: 'info', parts: [T("Pour réduire l'IFT, "), B(green.name), T(` (IFT ${green.ift.toFixed(1)}) préserve ${green.globalHarvest.toFixed(0)} % de la récolte.`)] });
      strats.forEach(s => { if (s.revenue - base.revenue - s.totalCost < 0) recs.push({ tone: 'warn', parts: [B(s.name), T(` coûte plus qu'elle ne rapporte (${fmtEur(s.revenue - base.revenue - s.totalCost)} / an) : ciblez les leviers sur les parcelles les plus exposées.`)] }); });
      strats.forEach(s => { if (s.peakDensity > THRESHOLD * 4) recs.push({ tone: 'warn', parts: [T('Avec '), B(s.name), T(`, la pression dépasse encore largement le seuil (${s.peakDensity.toLocaleString('fr-FR')} femelles/ha) : risque de résistance et de dégâts tardifs.`)] }); });
      const hasMultiYear = Object.values(strats[0].harvestByParcelYear).some(a => a.length > 1);
      if (hasMultiYear) {
        const decl = strats.find(s => Object.values(s.harvestByParcelYear).some(a => a.length > 1 && a[a.length - 1] < a[0] - 10));
        if (decl) recs.push({ tone: 'warn', parts: [T('Avec '), B(decl.name), T(", la récolte se dégrade d'année en année : le réservoir n'est pas maîtrisé. Envisagez prophylaxie et parasitoïdes dans les espaces naturels.")] });
      }
    } else recs.push({ tone: 'info', parts: [T("Créez une stratégie dans l'éditeur pour obtenir des recommandations comparatives.")] });
    if (parcels.some(p => p.type === 'forest')) recs.push({ tone: 'info', parts: [T('Les espaces naturels servent de réservoir hivernal : les lâchers de parasitoïdes y agissent sur le long terme (années 2-3).')] });
    return recs;
  });
}
