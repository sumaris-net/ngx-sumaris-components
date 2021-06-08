import {NgModule} from '@angular/core';
import {MatChipsField} from './material.chips';
import {MatChipsModule} from '@angular/material/chips';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {ReactiveFormsModule} from '@angular/forms';
import {SharedPipesModule} from '../../pipes/pipes.module';
import {SharedDirectivesModule} from '../../directives/directives.module';
import {MatCommonModule} from '@angular/material/core';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatSelectModule} from '@angular/material/select';
import {TranslateModule} from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SharedPipesModule,
    SharedDirectivesModule,
    MatCommonModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatChipsModule,
    TranslateModule.forChild(),
  ],
  declarations: [
    MatChipsField
  ],
  exports: [
    MatChipsField
  ]
})
export class MaterialChipsModule {

}
