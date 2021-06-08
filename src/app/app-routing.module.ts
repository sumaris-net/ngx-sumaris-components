import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {HomePage} from './core/home/home';
import {RegisterConfirmPage} from './core/register/confirm/confirm';
import {AccountPage} from './core/account/account';
import {SettingsPage} from './core/settings/settings.page';
import {AuthGuardService} from './core/services/auth-guard.service';
import {SHARED_ROUTE_OPTIONS, SharedRoutingModule} from './shared/shared-routing.module';

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


@NgModule({
  imports: [
    SharedRoutingModule,
    RouterModule.forRoot(routes, SHARED_ROUTE_OPTIONS)
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {
}
