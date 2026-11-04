import { Component } from '@angular/core';
import { IconBase } from './icons.utils';

/** Drosophile stylisée (pression, simulation) */
@Component({ selector: 'ds-icon-fly', host: { style: 'display: contents' }, templateUrl: './icon-fly.component.html' })
export class IconFly extends IconBase {}
