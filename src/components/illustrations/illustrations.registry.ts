import { type Type } from '@angular/core';
import { LifeCycleDiagram } from './life-cycle-diagram.component';
import { DailyStepDiagram } from './daily-step-diagram.component';
import { NeighborhoodDiagram } from './neighborhood-diagram.component';
import { PhenologyTimeline } from './phenology-timeline.component';
import { LeverMapDiagram } from './lever-map-diagram.component';
import { EconomicsDiagram } from './economics-diagram.component';

export const DIAGRAMS: Record<string, Type<unknown>> = {
  'cycle': LifeCycleDiagram,
  'pas-de-temps': DailyStepDiagram,
  'voisinage': NeighborhoodDiagram,
  'phenologie': PhenologyTimeline,
  'leviers': LeverMapDiagram,
  'economie': EconomicsDiagram,
};
