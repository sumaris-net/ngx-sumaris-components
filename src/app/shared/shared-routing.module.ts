import {Injectable, NgModule} from '@angular/core';
import {NoPreloading, PreloadAllModules, RouterModule} from '@angular/router';
import {ActivatedRouteSnapshot, ExtraOptions, RouteReuseStrategy} from '@angular/router';
import {IonicRouteStrategy} from '@ionic/angular';
import {QuicklinkModule, QuicklinkStrategy} from 'ngx-quicklink';

export const SHARED_ROUTE_OPTIONS: ExtraOptions = {
  enableTracing: false,
  //enableTracing: !environment.production,
  useHash: false,
  onSameUrlNavigation: 'reload',
  preloadingStrategy: QuicklinkStrategy
};

@Injectable()
export class CustomReuseStrategy extends IonicRouteStrategy {

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    const result = super.shouldReuseRoute(future, curr);

    // Force to reuse the route when:
    // - path change from [/new] -> [/:id]
    // - or path change from [/new] -> [/new?id=:id]
    if (!result && future.routeConfig && future.routeConfig === curr.routeConfig) {
      const pathIdParam = future.routeConfig.data && future.routeConfig.data.pathIdParam || 'id';
      const futureId = future.params[pathIdParam] === 'new' ?
        (future.queryParams[pathIdParam] || future.queryParams['id']) : future.params[pathIdParam];
      const currId = curr.params[pathIdParam] === 'new' ?
        (curr.queryParams[pathIdParam] || curr.queryParams['id']) : curr.params[pathIdParam];
      return futureId === currId &&
        // Always reload 'new' page
        currId !== 'new';
    }

    return result;
  }
}

@NgModule({
  imports: [
    RouterModule,
    QuicklinkModule
  ],
  exports: [
    QuicklinkModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ]
})
export class SharedRoutingModule {

  constructor() {
    console.debug('[shared-routing] Creating module...');
  }
}
