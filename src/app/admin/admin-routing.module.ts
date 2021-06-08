import {RouterModule, Routes} from '@angular/router';
import {UsersPage} from './users/list/users';
import {AuthGuardService} from '../core/services/auth-guard.service';
import {NgModule} from '@angular/core';
import {SharedRoutingModule} from '../shared/shared-routing.module';
import {AdminModule} from './admin.module';

const routes: Routes = [
  {
    path: 'users',
    pathMatch: 'full',
    component: UsersPage,
    canActivate: [AuthGuardService],
    data: {
      profile: 'ADMIN'
    }
  }
];

@NgModule({
  imports: [
    SharedRoutingModule,
    AdminModule,
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
