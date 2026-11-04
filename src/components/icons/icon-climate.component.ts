import { Component } from '@angular/core';
import { IconBase } from './icons.utils';

/** Thermomètre et feuille : climat (rubrique) */
@Component({ selector: 'ds-icon-climate', host: { style: 'display: contents' }, templateUrl: './icon-climate.component.html' })
export class IconClimate extends IconBase {}
