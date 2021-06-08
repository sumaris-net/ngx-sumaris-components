import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {ChipsTestPage} from './chips.test';
import {MaterialChipsModule} from '../chips.module';
import {SharedModule} from '../../../shared.module';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: ChipsTestPage
  }
];


@NgModule({
  imports: [
    CommonModule,
    TranslateModule.forChild(),
    RouterModule.forChild(routes),
    MaterialChipsModule,
    SharedModule
  ],
  declarations: [
    ChipsTestPage,
  ],
  exports: [
    ChipsTestPage,
  ]

})
export class ChipsTestingModule {
}
