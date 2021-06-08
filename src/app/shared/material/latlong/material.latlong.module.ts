import {NgModule} from '@angular/core';
import {MatCommonModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {SharedPipesModule} from '../../pipes/pipes.module';
import {MatLatLongField} from './material.latlong';
import {ReactiveFormsModule} from '@angular/forms';
import {TextMaskModule} from 'angular2-text-mask';
import {MatSelectModule} from '@angular/material/select';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SharedPipesModule,
    MatCommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    TextMaskModule,
    TranslateModule.forChild(),
    MatSelectModule
  ],
  exports: [
    MatLatLongField
  ],
  declarations: [
    MatLatLongField
  ]
})
export class SharedMatLatLongModule {
}

