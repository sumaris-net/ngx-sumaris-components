import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {RouterModule, Routes} from '@angular/router';
import {TableTestingModule} from './table/testing/table.testing.module';
import {TestingPage} from '../shared/material/testing/material.testing.page';
import {TableTestingPage} from './table/testing/table.testing';
import {HttpTranslateLoaderFactory} from '../shared/translate/http-translate-loader-factory';
import {HttpClient} from '@angular/common/http';

export const CORE_TESTING_PAGES = [
  <TestingPage>{label: 'Table', page: '/testing/core/table'}
];

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'table'
  },
  {
    path: 'table',
    pathMatch: 'full',
    component: TableTestingPage
  },
];

@NgModule({
  imports: [
    CommonModule,
    TranslateModule.forChild({loader: {
        provide: TranslateLoader,
        useFactory: HttpTranslateLoaderFactory.build,
        deps: [HttpClient]
      }}),
    TableTestingModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    TableTestingModule,
    RouterModule
  ]
})
export class CoreTestingModule {
}
