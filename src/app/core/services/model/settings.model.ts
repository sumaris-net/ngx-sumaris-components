import {isNil} from "../../../shared/functions";
import {Entity, EntityAsObjectOptions} from "./entity.model";
import {LatLongPattern} from "../../../shared/material/latlong/latlong.utils";
import {PropertiesMap, Property} from "../../../shared/types";
import {InjectionToken} from "@angular/core";
import {EntityClass} from "./entity.decorators";
import {HistoryPageReference} from "./history.model";

export type UsageMode = 'DESK' | 'FIELD';

export declare interface LocaleConfig extends Property {
  country?: string;
}

export const APP_LOCALES = new InjectionToken<LocaleConfig[]>('locales');

export declare interface OfflineFeature {
  name: string;
  lastSyncDate?: string;
  filter?: any;
}

export declare interface LocalSettings {
  pages?: any;
  peerUrl?: string;
  latLongFormat: 'DDMMSS' | 'DDMM' | 'DD';
  accountInheritance?: boolean;
  locale: string;
  usageMode?: UsageMode;
  mobile?: boolean;
  touchUi?: boolean;
  properties?: PropertiesMap;
  pageHistory?: HistoryPageReference[];
  offlineFeatures?: (string | OfflineFeature)[];
  pageHistoryMaxSize: number;
}


// @dynamic
@EntityClass({typename: 'UserSettingsVO'})
export class UserSettings extends Entity<UserSettings> {

  static fromObject: (source: any, opts?: any) => UserSettings;

  locale: string;
  latLongFormat: LatLongPattern;
  content: {};
  nonce: string;

  constructor() {
    super(UserSettings.TYPENAME);
  }

  asObject(options?: EntityAsObjectOptions): any {
    const target = super.asObject(options);
    target.content = this.content && JSON.stringify(target.content) || undefined;
    return target;
  }

  fromObject(source: any, opts?: any) {
    super.fromObject(source);
    this.locale = source.locale;
    this.latLongFormat = source.latLongFormat as LatLongPattern;
    if (isNil(source.content) || typeof source.content === 'object') {
      this.content = source.content || {};
    } else {
      this.content = source.content && JSON.parse(source.content) || {};
    }
    this.nonce = source.nonce;
  }
}
