import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {AutofocusDirective} from './autofocus.directive';


@NgModule({
  imports: [
    CommonModule,
    IonicModule
  ],
  declarations: [
    AutofocusDirective
  ],
  exports: [
    AutofocusDirective
  ]
})
export class SharedDirectivesModule {
}
