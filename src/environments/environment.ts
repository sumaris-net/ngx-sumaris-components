// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import {Environment} from './environment.class';

export const environment: Environment = Object.freeze({
  name: '@sumaris-net/ngx-components', // overridden by ENVIRONMENT token
  version: undefined, // overridden by ENVIRONMENT token
  production: true, // let to true ! because used by packager
  baseUrl: '/',
  defaultLocale: 'fr',
  defaultLatLongFormat: 'DDMM',
  apolloFetchPolicy: 'cache-first',

  // FIXME: GraphQL subscription never unsubscribe...
  listenRemoteChanges: false,

  // FIXME: enable cache
  persistCache: false,

  // TODO: make this works
  //offline: true,

  peerMinVersion: '1.8.0',

  defaultPeers: [
    {
      host: 'localhost',
      port: 8080
    },
    {
      host: 'localhost',
      port: 8081
    },
    {
      host: '192.168.0.45',
      port: 8080
    },
    {
      host: '192.168.0.24',
      port: 8080
    },
    {
      host: '192.168.0.29',
      port: 8080
    },
    {
      host: 'sih.sfa.sc',
      port: 80
    }
  ],
  defaultAppName: 'SUMARiS',
  defaultAndroidInstallUrl: 'https://play.google.com/store/apps/details?id=net.sumaris.app',

  // Storage
  storage: {
    driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
  },

  // About
  sourceUrl: 'https://gitlab.ifremer.fr/sih-public/sumaris/ngx-sumaris-components',
  reportIssueUrl: 'https://gitlab.ifremer.fr/sih-public/sumaris/ngx-sumaris-components/-/issues',
});

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
import 'zone.js/dist/zone-error';
