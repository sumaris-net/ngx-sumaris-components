import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AutocompleteTestPage} from '../autocomplete/testing/autocomplete.test';
import {LatLongTestPage} from '../latlong/testing/latlong.test';
import {MaterialTestingPage} from './material.testing.page';
import {SharedMaterialModule} from '../material.module';
import {IonicModule} from '@ionic/angular';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
import {SwipeTestPage} from '../swipe/testing/swipe.test';
import {TranslateModule} from '@ngx-translate/core';
import {DateTimeTestPage} from '../datetime/testing/mat-date-time.test';
import {ChipsTestPage} from '../chips/testing/chips.test';


const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: MaterialTestingPage
  },
  {
    path: 'autocomplete',
    pathMatch: 'full',
    component: AutocompleteTestPage
  },
  {
    path: 'datetime',
    pathMatch: 'full',
    component: DateTimeTestPage
  },
  {
    path: 'latlong',
    pathMatch: 'full',
    component: LatLongTestPage
  },
  // {
  //   path: 'numpad',
  //   pathMatch: 'full',
  //   component: NumpadTestPage
  // },
  {
    path: 'swipe',
    pathMatch: 'full',
    component: SwipeTestPage
  },
  {
    path: 'chips',
    pathMatch: 'full',
    component: ChipsTestPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    SharedMaterialModule,
    TranslateModule.forChild(),
    RouterModule.forChild(routes)
  ],
  declarations: [
    MaterialTestingPage,
    DateTimeTestPage,
    AutocompleteTestPage,
    LatLongTestPage,
    // NumpadTestPage,
    SwipeTestPage,
    ChipsTestPage
  ],
  exports: [
    SharedMaterialModule,
    RouterModule,
    DateTimeTestPage,
    MaterialTestingPage,
    AutocompleteTestPage,
    LatLongTestPage,
    // NumpadTestPage,
    SwipeTestPage,
    ChipsTestPage
  ]
})
export class MaterialTestingModule {
}
