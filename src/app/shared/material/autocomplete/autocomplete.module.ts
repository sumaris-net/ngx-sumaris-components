import {NgModule} from '@angular/core';
import {MatCommonModule} from '@angular/material/core';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatSelectModule} from '@angular/material/select';
import {MatAutocompleteField} from './material.autocomplete';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {IonicModule} from '@ionic/angular';
import {SharedPipesModule} from '../../pipes/pipes.module';
import {ReactiveFormsModule} from '@angular/forms';
import {SharedDirectivesModule} from '../../directives/directives.module';

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
    TranslateModule.forChild()
  ],
  exports: [
    MatAutocompleteModule,
    MatAutocompleteField
  ],
  declarations: [
    MatAutocompleteField
  ]
})
export class SharedMatAutocompleteModule {
}

