// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// Environment to use only with unit tests

import {Environment} from './environment.class';

const pkg = require('../../package.json');

export const environment: Environment = Object.freeze({
  name: (pkg.name as string),
  version: (pkg.version as string),
  production: false,
  baseUrl: '/',
  defaultLocale: 'fr',
  defaultLatLongFormat: 'DDMM',
  apolloFetchPolicy: 'cache-first',
  mock: false,

  // FIXME: GraphQL subscription never unsubscribe...
  listenRemoteChanges: false,

  // FIXME: enable cache
  persistCache: false,

  peerMinVersion: '1.8.0',

  // TODO: make this works
  //offline: true,

  defaultPeer: {
    host: 'localhost',
    port: 8080
  },
  defaultPeers: [
    {
      host: 'localhost',
      port: 8080
    },
    {
      host: 'localhost',
      port: 8081
    }
  ],

  defaultAppName: 'SUMARiS',
  defaultAndroidInstallUrl: 'https://play.google.com/store/apps/details?id=net.sumaris.app',

  // Storage
  storage: {
    driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
  },

  // About
  sourceUrl: (pkg.repository && pkg.repository.url as string),
  reportIssueUrl: (pkg.bugs && pkg.bugs.url as string),
});

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
import 'zone.js/dist/zone-error';
