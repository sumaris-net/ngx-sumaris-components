import {NgModule} from '@angular/core';
import {ExtraOptions, RouterModule, Routes} from '@angular/router';
import {HomePage} from './core/home/home';
import {RegisterConfirmPage} from './core/register/confirm/confirm';
import {AccountPage} from './core/account/account';
import {SettingsPage} from './core/settings/settings.page';
import {AuthGuardService} from './core/services/auth-guard.service';
import {SharedRoutingModule} from './shared/shared-routing.module';
import {APP_MENU_ITEMS} from './core/menu/menu.component';
import {MenuItem} from './core/menu/menu.model';

const routes: Routes = [
  // Core path
  {
    path: '',
    component: HomePage
  },

  {
    path: 'home/:action',
    component: HomePage
  },
  {
    path: 'confirm/:email/:code',
    component: RegisterConfirmPage
  },
  {
    path: 'account',
    pathMatch: 'full',
    component: AccountPage,
    canActivate: [AuthGuardService]
  },
  {
    path: 'settings',
    pathMatch: 'full',
    component: SettingsPage
  },

  // Admin
  {
    path: 'admin',
    canActivate: [AuthGuardService],
    loadChildren: () => import('./admin/admin-routing.module').then(m => m.AdminRoutingModule)
  },

  // Test module (disable in menu, by default - can be enable by the Pod configuration page)
  {
    path: 'testing',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'shared',
      },
      // Shared module
      {
        path: 'shared',
        loadChildren: () => import('./shared/shared.testing.module').then(m => m.SharedTestingModule)
      },
      // Core module
      {
        path: 'core',
        loadChildren: () => import('./core/core.testing.module').then(m => m.CoreTestingModule)
      }
    ]
  },

  // Other route redirection (should at the end of the array)
  {
    path: '**',
    redirectTo: '/'
  }
];

// Menu items
const MENU_ITEMS: MenuItem[] = [
  {title: 'MENU.HOME', path: '/', icon: 'home'},

  // Admin
  {title: 'MENU.ADMINISTRATION_DIVIDER', profile: 'ADMIN'},
  {title: 'MENU.USERS', path: '/admin/users', icon: 'people', profile: 'ADMIN'},

  // Settings
  {title: '' /*empty divider*/, cssClass: 'flex-spacer'},
  {title: 'MENU.TESTING', path: '/testing', icon: 'code', color: 'danger'},
  {title: 'MENU.LOCAL_SETTINGS', path: '/settings', icon: 'settings', color: 'medium'},
  {title: 'MENU.ABOUT', action: 'about', matIcon: 'help_outline', color: 'medium', cssClass: 'visible-mobile'},

  // Logout
  {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'medium hidden-mobile'},
  {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'danger visible-mobile'}

];

export const ROUTE_OPTIONS: ExtraOptions = {
  enableTracing: false,
  //enableTracing: !environment.production,
  useHash: false,
  onSameUrlNavigation: 'reload'
};

@NgModule({
  imports: [
    SharedRoutingModule,
    RouterModule.forRoot(routes, ROUTE_OPTIONS)
  ],
  exports: [
    RouterModule
  ],
  providers: [
    {provide: APP_MENU_ITEMS, useValue: MENU_ITEMS}
  ]
})
export class AppRoutingModule {
}
