import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  template: `
    <ion-spinner *ngIf="loading; else content" [color]="color" [name]="name"></ion-spinner>
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `
})
export class AppLoadingSpinner  {
  @Input() loading = false;
  @Input() color: string | undefined = 'secondary';
  @Input() name: 'bubbles' | 'circles' | 'circular' | 'crescent' | 'dots' | 'lines' | 'lines-small' | undefined;
}
