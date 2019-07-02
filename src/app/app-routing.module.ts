import {NgModule} from '@angular/core';
import {ExtraOptions, RouterModule, Routes} from '@angular/router';
import {HomePage} from './core/home/home';
import {RegisterConfirmPage} from './core/register/confirm/confirm';
import {AccountPage} from './core/account/account';
import {AuthGuardService} from './core/core.module';
import {UsersPage} from './admin/users/list/users';
import {VesselsPage} from './referential/vessel/list/vessels';
import {VesselPage} from './referential/vessel/page/page-vessel';
import {ReferentialsPage} from './referential/list/referentials';
import {TripPage, TripsPage} from './trip/trip.module';
import {OperationPage} from './trip/operation/operation.page';
import {ExtractionTablePage} from "./trip/extraction/extraction-table-page.component";
import {ConfigPage} from './admin/config/config.component';
import {ObservedLocationPage} from "./trip/observedlocation/observed-location.page";
import {ObservedLocationsPage} from "./trip/observedlocation/observed-locations.page";
import {SettingsPage} from "./core/settings/settings.page";
import {ExtractionMapPage} from "./trip/extraction/extraction-map-page.component";
import {LandingPage} from "./trip/landing/landing.page";
import {AuctionControlLandingPage} from "./trip/landing/auctioncontrol/auction-control-landing.page";
import {SubBatchesModal} from "./trip/batch/sub-batches.modal";

const routeOptions: ExtraOptions = {
  enableTracing: false,
  //enableTracing: !environment.production,
  useHash: false
};

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
    path: 'admin/users',
    pathMatch: 'full',
    component: UsersPage,
    canActivate: [AuthGuardService],
    data: {
      profile: 'ADMIN'
    }
  },
  {
    path: 'admin/config',
    pathMatch: 'full',
    component: ConfigPage,
    canActivate: [AuthGuardService],
    data: {
      profile: 'ADMIN'
    }
  },

  // Referential path
  {
    path: 'referential',
    canActivate: [AuthGuardService],
    children: [
      {
        path: 'vessels',
        children: [
          {
            path: '',
            component: VesselsPage,
            data: {
              profile: 'USER'
            }
          },
          {
            path: ':id',
            component: VesselPage,
            data: {
              profile: 'USER'
            }
          }
        ]
      },
      {
        path: 'list',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: ReferentialsPage,
            data: {
              profile: 'ADMIN'
            }
          }
        ]
      }
    ]
  },

  // Trip path
  {
    path: 'trips',
    canActivate: [AuthGuardService],
    runGuardsAndResolvers: 'pathParamsChange',
    data: {
      profile: 'USER'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: TripsPage
      },
      {
        path: ':tripId',
        children: [
          {
            path: '',
            pathMatch: 'full',
            component: TripPage
          },
          {
            path: 'operations/:id',
            children: [
              {
                path: '',
                pathMatch: 'full',
                component: OperationPage
              },
              {
                path: 'batches',
                component: SubBatchesModal
              }
            ]
          }
        ]
      },

      {
        path: ':tripId/landing/:id',
        component: LandingPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER'
        }
      }
    ]
  },

  // Observations path
  {
    path: 'observations',
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ObservedLocationsPage,
        data: {
          profile: 'USER'
        }
      },
      {
        path: ':id',
        component: ObservedLocationPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER'
        }
      },
      {
        path: ':observedLocationId/landing/:id',
        component: LandingPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER'
        }
      },
      {
        path: ':observedLocationId/control/:id',
        component: AuctionControlLandingPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER'
        }
      }
    ]
  },

  {
    path: 'extraction',
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ExtractionTablePage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'SUPERVISOR'
        }
      }
    ]
  },

  {
    path: 'map',
    canActivate: [AuthGuardService],
    children: [
      {
        path: '',
        //pathMatch: 'full',
        component: ExtractionMapPage,
        runGuardsAndResolvers: 'pathParamsChange',
        data: {
          profile: 'USER'
        }
      }
    ]
  },

  {
    path: "**",
    redirectTo: '/'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, routeOptions)
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {
}
