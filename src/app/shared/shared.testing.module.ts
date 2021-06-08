import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MaterialTestingModule} from './material/testing/material.testing.module';
import {TranslateModule} from '@ngx-translate/core';


@NgModule({
  imports: [
    CommonModule,
    TranslateModule.forChild(),
    MaterialTestingModule
  ],
  exports: [
    MaterialTestingModule
  ]
})
export class SharedTestingModule {
}
