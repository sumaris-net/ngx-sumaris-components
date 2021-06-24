import {ModuleWithProviders, NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';
import {AuthForm} from './auth/form/form-auth';
import {AuthModal} from './auth/modal/modal-auth';
import {AboutModal} from './about/modal-about';
import {RegisterConfirmPage} from './register/confirm/confirm';
import {AccountPage} from './account/account';
import {SharedModule} from '../shared/shared.module';
import {EntityMetadataComponent} from './form/entity-metadata.component';
import {FormButtonsBarComponent} from './form/form-buttons-bar.component';
import {TableSelectColumnsComponent} from './table/table-select-columns.component';
import {IonicStorageModule} from '@ionic/storage';
import {HomePage} from './home/home';
import {RegisterForm} from './register/form/form-register';
import {RegisterModal} from './register/modal/modal-register';
import {AppGraphQLModule} from './graphql/graphql.module';
// import ngx-translate and the http loader
import {HttpClientModule} from '@angular/common/http';
import {SelectPeerModal} from './peer/select-peer.modal';
import {SettingsPage} from './settings/settings.page';
import {CacheModule} from 'ionic-cache';
import {AppPropertiesForm} from './form/properties.form';
import {AppListForm} from './form/list.form';
import {PlatformService} from './services/platform.service';
import {IsNotOnFieldModePipe, IsOnFieldModePipe} from './services/pipes/usage-mode.pipes';
import {PersonToStringPipe} from './services/pipes/person-to-string.pipe';
import {AppInstallUpgradeCard} from './install/install-upgrade-card.component';
import {AccountToStringPipe, IsLoginAccountPipe} from './services/pipes/account.pipes';
import {DepartmentToStringPipe} from './services/pipes/department-to-string.pipe';
import {NgxJdenticonModule} from 'ngx-jdenticon';
import {AppMenuModule} from './menu/menu.module';

@NgModule({
  imports: [
    SharedModule,
    RouterModule,
    HttpClientModule,
    AppGraphQLModule,
    CacheModule,
    IonicStorageModule,
    NgxJdenticonModule,
    AppMenuModule
  ],

  declarations: [
    // Pipes
    IsOnFieldModePipe,
    IsNotOnFieldModePipe,
    PersonToStringPipe,
    IsLoginAccountPipe,
    AccountToStringPipe,
    DepartmentToStringPipe,

    // Home and menu
    HomePage,
    AboutModal,

    // Auth & Register
    AuthForm,
    AuthModal,
    RegisterForm,
    RegisterModal,
    RegisterConfirmPage,
    AccountPage,
    SettingsPage,

    // Network
    SelectPeerModal,
    AppInstallUpgradeCard,

    // Other components
    TableSelectColumnsComponent,
    EntityMetadataComponent,
    FormButtonsBarComponent,
    AppPropertiesForm,
    AppListForm

  ],
  exports: [
    SharedModule,
    RouterModule,
    AppGraphQLModule,
    AppMenuModule,

    // Pipes
    IsOnFieldModePipe,
    IsNotOnFieldModePipe,
    PersonToStringPipe,
    IsLoginAccountPipe,
    AccountToStringPipe,

    // Components
    HomePage,
    AuthForm,
    AuthModal,
    TableSelectColumnsComponent,
    EntityMetadataComponent,
    FormButtonsBarComponent,
    AboutModal,
    AppPropertiesForm,
    AppListForm,
    AppInstallUpgradeCard,
    DepartmentToStringPipe,
  ]
})
export class CoreModule {

  static forRoot(): ModuleWithProviders<CoreModule> {
    console.info('[core] Creating module (root)');
    return {
      ngModule: CoreModule,
      providers: [ PlatformService ]
    };
  }
}
