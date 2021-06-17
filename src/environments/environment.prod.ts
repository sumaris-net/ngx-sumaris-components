import {Environment} from './environment.class';

/* eslint-disable */
export const environment: Environment = Object.freeze({
  name: '@sumaris-net/ngx-components',
  version: ndefined, // overridden by ENVIRONMENT token
  production: true,
  baseUrl: '/',
  defaultLocale: 'fr',
  defaultLatLongFormat: 'DDMM',
  apolloFetchPolicy: 'cache-first',

  peerMinVersion: '1.0.0',
  listenRemoteChanges: false,
  persistCache: false,
  defaultPeer: null,
  // Production and public peers
  defaultPeers: [
    // No default peer in production
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
/* eslint-enable */
