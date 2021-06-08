import {EventEmitter, Inject, Injectable, InjectionToken, Optional} from '@angular/core';
import {LocalSettings, OfflineFeature, UsageMode} from './model/settings.model';
import {Peer} from './model/peer.model';
import {TranslateService} from '@ngx-translate/core';
import {Storage} from '@ionic/storage';

import {
  getPropertyByPath,
  isEmptyArray,
  isNil,
  isNotEmptyArray,
  isNotNil,
  isNotNilOrBlank,
  toBoolean
} from '../../shared/functions';
import {Subject} from 'rxjs';
import {Platform} from '@ionic/angular';
import {FormFieldDefinition, FormFieldDefinitionMap} from '../../shared/form/field.model';
import * as momentImported from 'moment';
import {Moment} from 'moment';
import {debounceTime, filter} from 'rxjs/operators';
import {LatLongPattern} from '../../shared/material/latlong/latlong.utils';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {environment} from '../../../environments/environment';
import {fromDateISOString} from '../../shared/dates';
import {HistoryPageReference} from './model/history.model';

const moment = momentImported;

export const SETTINGS_STORAGE_KEY = 'settings';
export const SETTINGS_TRANSIENT_PROPERTIES = ['mobile', 'touchUi'];

// fixme: this constant points to static environment
const DEFAULT_SETTINGS: LocalSettings = {
  accountInheritance: true,
  locale: environment.defaultLocale,
  latLongFormat: environment.defaultLatLongFormat || 'DDMM',
  pageHistoryMaxSize: 3
};

export const APP_LOCAL_SETTINGS = new InjectionToken<Partial<LocalSettings>>('DefaultLocalSettings');
export const APP_LOCAL_SETTINGS_OPTIONS = new InjectionToken<FormFieldDefinitionMap>('LocalSettingsOptions');

export declare interface AddToPageHistoryOptions {
  removePathQueryParams?: boolean;
  removeTitleSmallTag?: boolean;
  emitEvent?: boolean;
}

@Injectable({
  providedIn: 'root',
  deps: [APP_LOCAL_SETTINGS, APP_LOCAL_SETTINGS_OPTIONS]
})
export class LocalSettingsService {

  private readonly _debug: boolean;
  private _started = false;
  private _startPromise: Promise<any>;
  private readonly _optionDefs: FormFieldDefinition[];
  private _$persist: EventEmitter<any>;
  private data: LocalSettings;

  onChange = new Subject<LocalSettings>();

  get settings(): LocalSettings {
    return this.data || this.defaultSettings;
  }

  get locale(): string {
    return this.data && this.data.locale || this.translate.currentLang || this.translate.defaultLang;
  }

  get latLongFormat(): LatLongPattern {
    return this.data && this.data.latLongFormat || 'DDMM';
  }

  get usageMode(): UsageMode {
    return (this.data && this.data.usageMode || (this.mobile ? 'FIELD' : 'DESK'));
  }

  get mobile(): boolean {
    return this.data && toBoolean(this.data.mobile, this.platform.is('mobile'));
  }

  set mobile(value: boolean) {
    this.data.mobile = value;
  }

  get touchUi(): boolean {
    return this.data.touchUi;
  }

  set touchUi(value: boolean) {
    this.data.touchUi = value;
  }

  get pageHistory(): HistoryPageReference[] {
    return (this.data && this.data.pageHistory || []);
  }

  constructor(
    private translate: TranslateService,
    private platform: Platform,
    private storage: Storage,
    @Inject(ENVIRONMENT) protected environment,
    @Optional() @Inject(APP_LOCAL_SETTINGS) private readonly defaultSettings: LocalSettings,
    @Optional() @Inject(APP_LOCAL_SETTINGS_OPTIONS) defaultOptionsMap: FormFieldDefinitionMap
  ) {
    this.defaultSettings = {...DEFAULT_SETTINGS, ...this.defaultSettings};

    this._optionDefs = Object.values(defaultOptionsMap);

    this.resetData();

    this._debug = !environment.production;
    if (this._debug) console.debug('[settings] Creating service');
  }

  start(): Promise<LocalSettings> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return Promise.resolve(this.data);

    console.info('[settings] Starting settings...');

    // Restoring local settings
    this._startPromise = this.platform.ready()
      .then(() => {
        this.data.mobile = isNotNil(this.data.mobile) ? this.data.mobile : this.platform.is('mobile');
        this.data.touchUi = this.data.mobile || this.platform.is('phablet') || this.platform.is('tablet');
        this.data.usageMode = this.data.mobile ? 'FIELD' : 'DESK'; // FIELD by default, if mobile detected
      })
      .then(() => this.restoreLocally())
      .then(data => {
        this._started = true;
        this._startPromise = undefined;
        return data;
      });
    return this._startPromise;
  }

  get started(): boolean {
    return this._started;
  }

  ready(): Promise<LocalSettings> {
    if (this._started) return Promise.resolve(this.data);
    return this.start();
  }

  isUsageMode(mode: UsageMode): boolean {
    return this.usageMode === mode;
  }

  isOnFieldMode(value?: UsageMode): boolean {
    return (value || this.usageMode) === 'FIELD';
  }

  async restoreLocally(): Promise<LocalSettings | undefined> {

    // Restore from storage
    const settingsStr = await this.storage.get(SETTINGS_STORAGE_KEY);

    // Restore local settings (or keep old settings)
    if (isNotNilOrBlank(settingsStr)) {
      console.info('[settings] Restoring previous settings...');

      const restoredData = JSON.parse(settingsStr);

      // Avoid to override transient properties
      SETTINGS_TRANSIENT_PROPERTIES.forEach(transientKey => {
        delete restoredData[transientKey];
      });

      this.data = Object.assign(this.data, restoredData);
    }

    // Emit event
    this.onChange.next(this.data);

    return this.data;
  }

  setProperty<T = string>(keyOrDef: string|FormFieldDefinition, value: T){
    if (!this.data) return;
    if (typeof keyOrDef === 'object') {
      this.setProperty(keyOrDef.key, value);
      return;
    }
    this.data.properties = this.data.properties || {};
    this.data.properties[keyOrDef] = isNil(value) ? undefined : value.toString();
  }

  getProperty(keyOrDef: string|FormFieldDefinition, defaultValue?: any): any {
    if (typeof keyOrDef === 'object') {
      return this.getProperty(keyOrDef.key, isNil(defaultValue) ? keyOrDef.defaultValue : defaultValue);
    }
    const value = this.data && this.data.properties && this.data.properties[keyOrDef];
    return isNotNil(value) ? value : defaultValue;
  }

  getPropertyAsBoolean(definition: FormFieldDefinition, defaultValue?: boolean): boolean {
    const value = this.getProperty(definition, defaultValue);
    return isNotNil(value) ? (value && value !== 'false') : undefined;
  }

  getPropertyAsInt(definition: FormFieldDefinition, defaultValue?: number): number {
    const value = this.getProperty(definition, defaultValue);
    return isNotNil(value) ? parseInt(value) : undefined;
  }

  getPropertyAsNumbers(definition: FormFieldDefinition, defaultValue?: number[]): number[] {
    const value = this.getProperty(definition, defaultValue);
    if (typeof value === 'string') return value.split(',').map(parseFloat) || undefined;
    return isNotNil(value) ? [parseFloat(value)] : undefined;
  }

  getPropertyAsStrings(definition: FormFieldDefinition, defaultValue?: string[]): string[] {
    const value = this.getProperty(definition, defaultValue);
    return value && value.split(',') || undefined;
  }

  async apply(settings: Partial<LocalSettings>, opts?: { emitEvent?: boolean; persistImmediate?: boolean }) {
    this.data = { ...this.data, ...settings};

    // Save locally
    if (opts && opts.persistImmediate) {
      await this.persistLocally(true);
    }
    else {
      this.persistLocally(); // No AWAIT
    }

    // Emit event
    if (!opts || opts.emitEvent !== false) {
      this.onChange.next(this.data);
    }
  }

  async applyProperty(key: keyof LocalSettings, value: any, opts?: { emitEvent?: boolean; persistImmediate?: boolean }) {
    const changes = {};
    changes[key] = value;
    await this.apply(changes, opts);
  }

  getPageSettings<T = any>(pageId: string, propertyName?: string): T {
    if (!this.data || !this.data.pages) return undefined;
    const key = pageId.replace(/[/]/g, '__');
    if (isNotNilOrBlank(propertyName)) {
      return getPropertyByPath(this.data.pages, key + '.' + propertyName);
    }
    return this.data.pages[key];
  }

  async savePageSetting(pageId: string, value: any, propertyName?: string) {
    this.data = this.data || this.defaultSettings;
    this.data.pages = this.data.pages || {};

    const key = pageId.replace(/[/]/g, '__');
    if (propertyName) {
      this.data.pages[key] = this.data.pages[key] || {};
      this.data.pages[key][propertyName] = value;
    }
    else {
      this.data.pages[key] = value;
    }

    // Update local settings
    this.persistLocally();
  }


  getOfflineFeature(featureName: string): OfflineFeature {
    if (!this.data || !this.data.offlineFeatures || isEmptyArray(this.data.offlineFeatures))
      return undefined;
    if (!featureName) throw Error('Missing \'featureName\' argument');

    featureName = featureName.toLowerCase();
    const featurePrefix = featureName + '#';
    const feature = this.data.offlineFeatures.find(f => {
      if (typeof f === 'string') return f.toLowerCase().startsWith(featurePrefix);
      if (typeof f === 'object' && f.name) return f.name === featureName;
    });
    if (!feature) return; // Not found
    if (typeof feature === 'string') {
      return {
        name: featureName,
        lastSyncDate: feature.substring(featurePrefix.length)
      };
    }
    return feature;
  }

  getOfflineFeatureLastSyncDate(featureName: string): Moment {
    const feature = this.getOfflineFeature(featureName);
    return feature && fromDateISOString(feature.lastSyncDate);
  }

  hasOfflineFeature(featureName?: string): boolean {
    if (featureName) return isNotNil(this.getOfflineFeature(featureName));
    return this.data && isNotEmptyArray(this.data.offlineFeatures);
  }

  saveOfflineFeature(feature: OfflineFeature) {
    this.data = this.data || this.defaultSettings;
    this.data.offlineFeatures = this.data.offlineFeatures || [];

    feature.name = feature.name.toLowerCase();

    const featurePrefix = feature.name + '#';
    const existingIndex = this.data.offlineFeatures.findIndex(f => {
      if (typeof f === 'string') return f.toLowerCase().startsWith(featurePrefix);
      if (typeof f === 'object' && f.name) return f.name === feature.name;
    });
    if (existingIndex !== -1) {
      this.data.offlineFeatures[existingIndex] = feature;
    }
    else {
      this.data.offlineFeatures.push(feature);
    }

    // Update local settings
    this.persistLocally();
  }

  markOfflineFeatureAsSync(featureName: string) {
    let feature = this.getOfflineFeature(featureName);

    if (!feature) {
      feature = <OfflineFeature>{
        name: featureName.toLowerCase(),
        lastSyncDate: moment().toISOString()
      };
    }
    else {
      feature.lastSyncDate = moment().toISOString();
    }

    this.saveOfflineFeature(feature);
  }

  removeOfflineFeatures() {
    if (this.data && this.data.offlineFeatures) {
      this.data.offlineFeatures = [];

      // Update local settings
      this.persistLocally();
    }
  }

  getFieldDisplayAttributes(fieldName: string, defaultAttributes?: string[]): string[] {
    const value = this.data && this.data.properties &&  this.data.properties[`sumaris.field.${fieldName}.attributes`];
    // Nothing found in settings: return defaults
    if (!value) return defaultAttributes || ['label', 'name'];

    return value.split(',');
  }

  getPageFieldDefaultValue(pageId: string, fieldName: string): any {
    return this.getPageSettings(pageId, `field.${fieldName}.defaultValue`);
  }

  get optionDefs(): FormFieldDefinition[] {
    return this._optionDefs;
  }

  registerOption(def: FormFieldDefinition) {
    if (this._optionDefs.findIndex(f => f.key === def.key) !== -1) {
      throw new Error(`Additional additional property {${def.key}} already define.`);
    }
    if (this._debug) console.debug(`[settings] Adding additional property {${def.key}}`, def);
    this._optionDefs.push(def);
  }

  registerOptions(defs: FormFieldDefinition[]) {
    (defs || []).forEach(def => this.registerOption(def));
  }

  async addToPageHistory(page: HistoryPageReference,
                         opts?: AddToPageHistoryOptions,
                         pageHistory?: HistoryPageReference[] // used for recursive call to children
  ) {
    // If not inside recursive call: fill page history defaults
    if (!pageHistory) this.fillPageHistoryDefaults(page, opts);

    pageHistory = pageHistory || this.data.pageHistory;

    const index = pageHistory.findIndex(p => (
      // same path
      p.path === page.path
      // or sub-path
      || page.path.startsWith(p.path + '/'))
    );

    // New page: insert it
    if (index === -1) {
      //if (this._debug)
      console.debug('[settings] Adding page to history: ', page);

      // Prepend to list
      pageHistory.splice(0, 0, page);
    }

    else {
      const existingPage = pageHistory[index];

      // Same path: replace existing page
      if (pageHistory[index].path === page.path) {
        //if (this._debug)
        console.debug('[settings] Updating existing page in history: ', page);
        pageHistory.splice(index, 1);

        // Copy exiting children
        page.children = existingPage.children || [];

        // Prepend to list
        pageHistory.splice(0, 0, page);
      }

      // Not same path (should be a parent page)
      else {
        // Create parent's children array, if not exists
        existingPage.children = existingPage.children || [];

        // Update the parent time
        existingPage.time = page.time;

        // Add page as parent's children (recursive call)
        await this.addToPageHistory(page, opts, existingPage.children);
      }
    }

    // Save locally (only if not a recursive execution)
    if (pageHistory === this.data.pageHistory) {

      // If max has been reached, remove old pages
      if (this.data.pageHistory.length > this.data.pageHistoryMaxSize) {
        const removedPages = pageHistory.splice(this.data.pageHistoryMaxSize, pageHistory.length - this.data.pageHistoryMaxSize);
        console.debug('[settings] Pages removed from history: ', removedPages);
      }

      // Apply new value
      await this.applyProperty('pageHistory', pageHistory);
    }
  }

  async removePageHistory(path: string,
                          opts?: {emitEvent?: boolean },
                          pageHistory?: HistoryPageReference[] // used for recursive call to children)
  ) {
    pageHistory = pageHistory || this.data.pageHistory;

    const index = pageHistory.findIndex(p => p.path === path);
    let found = index !== -1;
    if (found) {
      console.debug('[settings] Remove page history: ', path);
      // Remove value
      pageHistory.splice(index, 1);
    }
    else {
      // Search path on children (stop when found)
      found = pageHistory
        .map(p => p.children)
        .filter(isNotEmptyArray)
        .findIndex(children => this.removePageHistory(path, opts, children)) !== -1;
    }

    // Save locally (only if not a recursive execution)
    if (found && pageHistory === this.data.pageHistory) {
      // Apply changes
      await this.applyProperty('pageHistory', this.data.pageHistory);
    }

    return found;
  }

  async clearPageHistory() {
    // Reset all page history
    await this.applyProperty('pageHistory', [], {persistImmediate: true});
  }

  /* -- Protected methods -- */

  private resetData() {
    this.data = {...this.data, ...this.defaultSettings};

    this.data.locale = this.translate.currentLang || this.translate.defaultLang;
    this.data.mobile = undefined;
    this.data.usageMode = undefined;
    this.data.pageHistory = [];

    const defaultPeer = this.environment.defaultPeer && Peer.fromObject(this.environment.defaultPeer);
    this.data.peerUrl = defaultPeer && defaultPeer.url || undefined;

    if (this._started) this.onChange.next(this.data);
  }

  private persistLocally(immediate?: boolean): Promise<any> {

    // Execute immediate
    if (immediate) {
      if (!this.data) {
        console.debug('[settings] Removing local settings from storage');
        return this.storage.remove(SETTINGS_STORAGE_KEY);
      }
      else {
        console.debug('[settings] Store local settings', this.data);
        return this.storage.set(SETTINGS_STORAGE_KEY, JSON.stringify(this.data));
      }
    }

    // Execute with delay
    else {

      // Create the event emitter
      if (!this._$persist) {
        this._$persist = new EventEmitter<any>(true);
        this._$persist
          .pipe(
            debounceTime(2000), // add a delay of 2s
            filter(() => this._started)
          )
          .subscribe(() => this.persistLocally(true));
      }

      this._$persist.emit();
    }
  }

  private fillPageHistoryDefaults(page: HistoryPageReference, opts?: {
      removePathQueryParams?: boolean;
    removeTitleSmallTag?: boolean;
  }): HistoryPageReference {
    if (!page || !page.title || !page.path) throw Error('Missing required argument \'page\', \'page.path\' or \'page.title\'');

    // Set time
    page.time = page.time || moment();

    // Clean the title (remove <small> tags)
    if (!opts || opts.removeTitleSmallTag !== false) {
      const tagIndex = page.title.indexOf('</small>');
      if (tagIndex !== -1) {
        page.title = page.title.substring(tagIndex + '</small>'.length);
      }
      page.title = page.title.replace(/[ ]*class='hidden-xs hidden-sm'/g, '');
    }

    // Remove query params
    if (!opts || opts.removePathQueryParams !== false) {
      page.path = page.path.replace(/[?].*$/, '');
    }

    return page;
  }
}
