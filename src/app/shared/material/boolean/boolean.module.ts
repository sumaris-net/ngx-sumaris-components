import {NgModule} from '@angular/core';
import {MatCommonModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {SharedPipesModule} from '../../pipes/pipes.module';
import {ReactiveFormsModule} from '@angular/forms';
import {TextMaskModule} from 'angular2-text-mask';
import {NgxMaterialTimepickerModule} from 'ngx-material-timepicker';
import {MatBooleanField} from './material.boolean';
import {MatRadioModule} from '@angular/material/radio';
import {MatCheckboxModule} from '@angular/material/checkbox';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SharedPipesModule,
    MatCommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatCheckboxModule,
    TextMaskModule,
    NgxMaterialTimepickerModule,
    TranslateModule.forChild()
  ],
  exports: [
    MatBooleanField
  ],
  declarations: [
    MatBooleanField
  ]
})
export class SharedMatBooleanModule {
}

