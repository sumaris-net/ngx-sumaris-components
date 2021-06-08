import {Inject, Injectable, Optional} from '@angular/core';
import {Platform, ToastController} from '@ionic/angular';
import {NetworkService} from './network.service';
import {Platforms} from '@ionic/core';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Keyboard} from '@ionic-native/keyboard/ngx';
import {LocalSettingsService} from './local-settings.service';
import {CacheService} from 'ionic-cache';
import {AudioProvider} from '../../shared/audio/audio';

import {InAppBrowser} from '@ionic-native/in-app-browser/ngx';
import {isEmptyArray, isNil, isNotNil} from '../../shared/functions';
import {Storage} from '@ionic/storage';
import {EntitiesStorage} from './storage/entities-storage.service';
import {StorageUtils} from '../../shared/services/storage.utils';
import {ShowToastOptions, Toasts} from '../../shared/toasts';
import {TranslateService} from '@ngx-translate/core';
import * as momentImported from 'moment';
import {AccountService} from './account.service';
import {timer} from 'rxjs';
import {filter, first} from 'rxjs/operators';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {ConfigService} from './config.service';
import {CORE_CONFIG_OPTIONS} from './config/core.config';
import {MomentDateAdapter} from '@angular/material-moment-adapter';

const moment = momentImported;

@Injectable({providedIn: 'root'})
export class PlatformService {

  private readonly _debug: boolean;
  private _started = false;
  private _startPromise: Promise<void>;
  private _mobile: boolean;

  touchUi: boolean;

  get started(): boolean {
    return this._started;
  }

  get mobile(): boolean {
    return isNotNil(this._mobile) ? this._mobile : this.platform.is('mobile');
  }

  constructor(
    private platform: Platform,
    private toastController: ToastController,
    private translate: TranslateService,
    private dateAdapter: MomentDateAdapter,
    private entitiesStorage: EntitiesStorage,
    private settings: LocalSettingsService,
    private networkService: NetworkService,
    private accountService: AccountService,
    private configService: ConfigService,
    private cache: CacheService,
    private storage: Storage,
    private audioProvider: AudioProvider,
    @Inject(ENVIRONMENT) protected environment,
    @Optional() private statusBar: StatusBar,
    @Optional() private keyboard: Keyboard,
    @Optional() private splashScreen: SplashScreen,
    @Optional() private browser: InAppBrowser
  ) {

    this._debug = !environment.production;
    if (this._debug) console.debug('[platform] Creating service');

    this.start();
  }

  is(platformName: Platforms): boolean {
    return this.platform.is(platformName);
  }

  /**
   * Say if opened has been opened from a web browser (and NOT inside an Android or iOs App).
   * This is used to known if there is cordova features
   */
  isWebOrDesktop(): boolean {
    return !this.platform.is('mobile') || this.platform.is('mobileweb');
  }

  width(): number {
    return this.platform.width();
  }

  height(): number {
    return this.platform.height();
  }

  start(): Promise<void> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return Promise.resolve();

    this._started = false;
    const now = Date.now();
    console.info('[platform] Starting platform...');

    this._startPromise = this.platform.ready()
      .then(() => {

        this._mobile = this.platform.is('mobile');

        this.configureCordovaPlugins(this._mobile);
        this.touchUi = this._mobile || this.platform.is('tablet') || this.platform.is('phablet');

        // Force mobile in settings
        if (this._mobile) {
          this.settings.mobile = this._mobile;
          this.settings.touchUi = this.touchUi;
        }

        this.configureTranslate();
    })
    .then(() => this.storageReady())
    .then((forage) => this.migrateStorage(forage))
    .then(() => Promise.all([
      this.entitiesStorage.ready(),
      this.cache.ready().then(() => this.configureCache()),
      this.settings.ready(),
      this.networkService.ready(),
      this.audioProvider.ready()
    ]))
    .then(() => {
      this._started = true;
      this._startPromise = undefined;
      console.info(`[platform] Starting platform [OK] {mobile: ${this._mobile}, touchUi: ${this.touchUi}} in ${Date.now() - now}ms`);

      // Update cache configuration when network changed
      this.networkService.onNetworkStatusChanges.subscribe((type) => this.configureCache(type !== 'none'));

      // Update authentication type
      this.configService.config.subscribe(config => {
        this.accountService.tokenType = config.getProperty(CORE_CONFIG_OPTIONS.AUTH_TOKEN_TYPE);
      });

      // Wait 1 more seconds, before hiding the splash screen
      setTimeout(() => {
        if (this.splashScreen) this.splashScreen.hide();

        // Play startup sound
        this.audioProvider.playStartupSound();
      }, 1000);
    })
      // Manage error
      .catch(err => this.onStartupError(err));
    return this._startPromise;
  }

  /**
   * Wait platform is ready.<br/>
   * Important: this will NOT start the platform, has it should be started by the AppComponent
   *
   * @param opts
   */
  ready(opts?: {
    checkPeriod: number;
  }): Promise<any> {
    const period = opts && opts.checkPeriod || 300;
    if (this._started) return Promise.resolve();
    return timer(period, period)
      .pipe(
        // For DEBUG :
        //tap(() => this._debug && console.debug("Waiting platform ready...")),
        filter(() => this._started),
        first()
      ).toPromise();
  }

  open(url: string, target?: string, features?: string, replace?: boolean) {
    if (this.browser && this._mobile) {
      this.browser.create(url, target, features).show();
    }
    else {
      window.open(url, target, features, replace);
    }
  }
  /*
  chooseFile(): Promise<> {

  }*/

  /* -- protected methods -- */

  protected configureCordovaPlugins(mobile: boolean) {
    console.info('[platform] Configuring Cordova plugins...');

    if (this.statusBar) {
      this.statusBar.styleDefault();
      this.statusBar.overlaysWebView(false);
    }
    if (this.keyboard) {
      this.keyboard.hideFormAccessoryBar(true);
    }

    // Force to use InAppBrowser instead of default window.open()
    if (this.browser) {
      // FIXME: this create a infinite loop (e.g. when downloading an extraction file)
      // window.open = (url?: string, target?: string, features?: string, replace?: boolean) => {
      //   console.debug("[platform] Call to window.open() redirected to InAppBrowser.open()");
      //   this.browser.create(url, target, features).show();
      //   return window;
      // };
    }
  }


  protected configureTranslate() {
    console.info('[platform] Configuring i18n ...');

    // this language will be used as a fallback when a translation isn't found in the current language
    this.translate.setDefaultLang(this.environment.defaultLocale);

    // When locale changes, apply to date adapter
    this.translate.onLangChange.subscribe(event => {
      if (event && event.lang) {

        // force 'en' as 'en_GB'
        if (event.lang === 'en') {
          event.lang = 'en_GB';
        }

        // config moment lib
        try {
          moment.locale(event.lang);
          console.debug('[platform] Use locale {' + event.lang + '}');
        }
          // If error, fallback to en
        catch (err) {
          moment.locale('en');
          console.warn('[platform] Unknown local for moment lib. Using default [en]');
        }

        // Config date adapter
        this.dateAdapter.setLocale(moment.locale());
      }
    });

    this.settings.onChange.subscribe(data => {
      if (data && data.locale && data.locale !== this.translate.currentLang) {
        this.translate.use(data.locale);
      }
    });

    // Use account's locale, when account inheritance enabled in settings
    this.accountService.onLogin.subscribe(account => {
      if (this.settings.settings.accountInheritance) {
        const accountLocale = account.settings && account.settings.locale;
        if (accountLocale && accountLocale !== this.settings.locale) {
          this.settings.apply({
            locale: accountLocale
          });
        }
      }
    });
  }

  protected configureCache(online?: boolean) {
    online = isNotNil(online) ? online : this.cache.isOnline();
    const cacheTTL = online ? 3600 /* 1h */ : 3600 * 24 * 30; /* 1 month */
    console.info(`[platform] Configuring cache [OK] {online: ${online}}, {timeToLive: ${cacheTTL / 3600}h}, {offlineInvalidate: false}`);
    this.cache.setDefaultTTL(cacheTTL);
    this.cache.setOfflineInvalidate(false); // Do not invalidate cache when offline
  }

  protected async storageReady(): Promise<LocalForage> {

    console.info(`[platform] Starting storage...`);
    const forage = await this.storage.ready();
    const driver = forage.driver();

    if (isNil(driver)) {
      console.error('[platform] NO DRIVER DEFINED IN STORAGE. Local storage cannot be used !');
      return Promise.resolve(forage);
    }

    console.info(`[platform] Starting storage [OK] {name: '${forage.config().name}', driver: '${forage.driver()}', size: ${forage.config().size}`);
    console.debug(`[platform] Storage supports: {${forage.WEBSQL}: ${forage.supports(forage.WEBSQL)}, ${forage.INDEXEDDB}: ${forage.supports(forage.INDEXEDDB)}, ${forage.LOCALSTORAGE}: ${forage.supports(forage.LOCALSTORAGE)}}`);

    return forage;
  }

  protected async migrateStorage(forage: LocalForage) {
    const canMigrate = forage &&
      ((forage.driver() === 'cordovaSQLiteDriver' && (forage.supports(forage.INDEXEDDB) || forage.supports(forage.WEBSQL))) ||
       (forage.driver() === forage.WEBSQL && forage.supports(forage.INDEXEDDB)));

    if (!canMigrate) return; // Skip

    const oldForage = forage.createInstance({
      name: forage.config().name,
      storeName: forage.config().storeName,
      driver: [forage.INDEXEDDB, forage.WEBSQL]
    });

    // IF data stored in the OLD storage: start migration
    const keys = await oldForage.keys();
    if (isEmptyArray(keys)) {
      // Drop the old instance
      console.info(`[platform] Drop old storage {name: '${forage.config().name}', driver: '${oldForage.driver()}'}`);
      await oldForage.dropInstance();
    }
    else {

      const now = Date.now();
      console.info(`[platform] Starting storage migration...`);

      const toast = await this.showToast({message: 'INFO.DATA_MIGRATION_STARTED',
          duration: 30000});
      try {
        await StorageUtils.copy(oldForage, forage, {keys, deleteAfterCopy: false});

        const duration = Date.now() - now;
        setTimeout(() => toast.dismiss(),  Math.max(2000 - duration, 0));
        await this.showToast({message: 'INFO.DATA_MIGRATION_SUCCEED',
          type: 'info',
          showCloseButton: true
        });
        console.info('[platform] Starting storage migration [OK]');

        // Drop the old instance
        console.info(`[platform] Drop old storage {name: '${forage.config().name}', driver: '${oldForage.driver()}'}`);
        await oldForage.dropInstance();
      }
      catch (err) {
        console.error(err && err.message || err, err);
        await toast.dismiss();
        await this.showToast({message: 'ERROR.DATA_MIGRATION_FAILED',
          type: 'error',
          showCloseButton: true
        });
      }
    }
  }

  protected showToast(opts: ShowToastOptions): Promise<HTMLIonToastElement> {
    if (!this.toastController) throw new Error('Missing toastController in component\'s constructor');
    return new Promise(resolve => Toasts.show(this.toastController, this.translate, {
        ...opts,
        onWillPresent: (t) => resolve(t)
      }));
  }

  protected async onStartupError(err) {
    console.error('[platform] Failed starting the platform! ', err);
    let message = err && err.message || err;
    const detailsMessage = err && (err.details && err.details.message || err.details);
    if (this.translate) {
      message = await this.translate.get(message).toPromise();
      if (err && err.code) {
        message += ` {code: ${err.code}}`;
      }
    }
    else {
      message = `Fatal error: Please contact your administrator.\n\n{code: ${err && err.code || 'null'}, message: "${message}"}`;
    }
    if (this.toastController) {
      if (detailsMessage) {
        message += `<br/><small>${detailsMessage}</small>`;
      }
      await this.showToast({
        type: 'error',
        duration: -1,
        showCloseButton: true,
        message
      });
    }
    else if (window) {
      if (detailsMessage) {
        message += `\n\n{cause: "${detailsMessage}"}`;
      }
      window.alert(message);
    }
    else {
      console.error(message);
      if (err && err.details) console.error('cause', err.details);
    }
  }
}

