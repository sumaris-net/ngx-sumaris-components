// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { Environment } from "./environment.class";
const pkg = require('../../package.json');

export const environment: Environment = {
    name: (pkg.name as string),
    version: (pkg.version as string),
    production: false,
    baseUrl: '/',

    remoteBaseUrl: "http://localhost:8080",
    //remoteBaseUrl: "https://adap.e-is.pro",
    //remoteBaseUrl: "https://www.sumaris.net",

    defaultLocale: "fr",
    defaultLatLongFormat: 'DDMM',

  //defaultProgram: "ADAP-MER",
    defaultProgram: "SUMARiS",

    apolloFetchPolicy: 'cache-first',

  // DEV only
    mock: true
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
import 'zone.js/dist/zone-error';
