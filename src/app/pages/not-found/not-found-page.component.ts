import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Drosophila } from '@/components/illustrations';

@Component({
  selector: 'ds-not-found-page',
  imports: [RouterLink, Drosophila],
  host: { style: 'display: contents' },
  templateUrl: './not-found-page.component.html',
})
export class NotFoundPage {}
