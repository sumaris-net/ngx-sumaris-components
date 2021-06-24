import {NgModule} from '@angular/core';
import {SharedModule} from '../../shared/shared.module';
import {MenuComponent} from './menu.component';
// import ngx-translate and the http loader
import {TranslateModule} from '@ngx-translate/core';
import {RouterModule} from '@angular/router';

@NgModule({
  imports: [
    SharedModule,
    RouterModule,
    TranslateModule
  ],

  declarations: [
    // Components
    MenuComponent
  ],
  exports: [
    // Modules
    TranslateModule,
    // Components
    MenuComponent
  ]
})
export class AppMenuModule {

}
