import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {MatNumpadComponent} from './numpad.component';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TranslateModule} from '@ngx-translate/core';
import {NumpadDirective} from './numpad.directive';
import {MatNumpadContainerComponent} from './numpad.container';
import {MatNumpadContent} from './numpad.content';
import {AppendToInputDirective} from './numpad.append-to-input.directive';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule.forChild()
  ],
  exports: [
    MatNumpadComponent,
    NumpadDirective,
    MatNumpadContainerComponent,
    MatNumpadContent,
    AppendToInputDirective
  ],
  declarations: [
    MatNumpadContainerComponent,
    MatNumpadComponent,
    MatNumpadContent,
    NumpadDirective,
    AppendToInputDirective
  ]
})
export class SharedMatNumpadModule {
}

