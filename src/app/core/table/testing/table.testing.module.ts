import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {TranslateModule} from "@ngx-translate/core";
import {CoreModule} from "../../core.module";
import {TableTestingPage} from "./table.testing";
import {SharedModule} from "../../../shared/shared.module";


@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    CoreModule,
    TranslateModule.forChild()
  ],
  declarations: [
    TableTestingPage
  ],
  exports: [
    TableTestingPage,
    TranslateModule
  ]
})
export class TableTestingModule {
}
