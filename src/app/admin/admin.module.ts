import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CoreModule} from '../core/core.module';
import {UsersPage} from './users/list/users';
import {SocialModule} from "../social/social.module";
import {NgxJdenticonModule} from "ngx-jdenticon";
import {TranslateModule} from "@ngx-translate/core";
import {SharedMaterialModule} from "../shared/material/material.module";

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    SocialModule,
    SharedMaterialModule,
    NgxJdenticonModule,
    TranslateModule.forChild()
  ],
  declarations: [
    UsersPage
  ],
  exports: [
    UsersPage
  ]
})
export class AdminModule {

  constructor() {
    console.debug('[admin] Creating module');
  }
}
