import {FetchPolicy} from '@apollo/client/core';
import {StorageConfig} from '@ionic/storage';
import {InjectionToken} from '@angular/core';

export const ENVIRONMENT = new InjectionToken<Environment>('ENV');

export class Environment {
  name: string;
  version: string;
  production: boolean;
  baseUrl: string;
  mock?: boolean;
  listenRemoteChanges?: boolean;

  // A peer to use at startup (useful on a web site deployment)
  defaultPeer?: { host: string; port: number; useSsl?: boolean; path?: string } | undefined | null;

  // A list of peers, to select as peer, in settings
  defaultPeers?: { host: string; port: number; useSsl?: boolean; path?: string }[];

  // Min compatible version for the peer
  peerMinVersion?: string;

  // Enable cache persistence ?
  persistCache?: boolean;

  // Force offline mode ? /!\ For DEV only
  offline?: boolean;

  // Apollo (graphQL) config
  apolloFetchPolicy?:  FetchPolicy;

  // Default values
  defaultLocale: string;
  defaultLatLongFormat?: 'DD' | 'DDMM' | 'DDMMSS';
  defaultDepartmentId?: number;
  defaultAppName?: string;
  defaultAndroidInstallUrl?: string;

  // Storage
  storage?: Partial<StorageConfig>;

  // About
  sourceUrl?: string;
  reportIssueUrl?: string;
}
