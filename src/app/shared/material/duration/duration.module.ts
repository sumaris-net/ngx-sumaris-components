import {NgModule} from '@angular/core';
import {MatCommonModule, MatRippleModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {SharedPipesModule} from '../../pipes/pipes.module';
import {ReactiveFormsModule} from '@angular/forms';
import {TextMaskModule} from 'angular2-text-mask';
import {NgxMaterialTimepickerModule} from 'ngx-material-timepicker';
import {MatDuration} from './material.duration';
import {MatMomentDateModule} from '@angular/material-moment-adapter';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SharedPipesModule,
    MatCommonModule,
    MatFormFieldModule,
    MatInputModule,
    TextMaskModule,
    NgxMaterialTimepickerModule,
    MatRippleModule,
    MatMomentDateModule,
    TranslateModule.forChild()
  ],
  exports: [
    MatDuration
  ],
  declarations: [
    MatDuration
  ]
})
export class SharedMatDurationModule {
}

