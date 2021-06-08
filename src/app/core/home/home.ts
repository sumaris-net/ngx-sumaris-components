import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  InjectionToken,
  OnDestroy,
  Optional
} from '@angular/core';
import {ModalController, ToastController} from '@ionic/angular';
import {RegisterModal} from '../register/modal/modal-register';
import {BehaviorSubject, Subscription} from 'rxjs';
import {AccountService} from '../services/account.service';
import {Account, accountToString} from '../services/model/account.model';
import {Configuration} from '../services/model/config.model';
import {Department} from '../services/model/department.model';
import {APP_LOCALES, LocaleConfig, LocalSettings} from '../services/model/settings.model';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '../services/config.service';
import {PlatformService} from '../services/platform.service';
import {LocalSettingsService} from '../services/local-settings.service';
import {debounceTime, distinctUntilChanged, map, startWith} from 'rxjs/operators';
import {AuthModal} from '../auth/modal/modal-auth';
import {NetworkService} from '../services/network.service';
import {MenuItem, MenuItems} from '../menu/menu.component';
import {ShowToastOptions, Toasts} from '../../shared/toasts';
import {fadeInAnimation, slideUpDownAnimation} from '../../shared/material/material.animations';
import {isNotNil, isNotNilOrBlank} from '../../shared/functions';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {HistoryPageReference} from '../services/model/history.model';

export function getRandomImage(files: String[]) {
  const imgIndex = Math.floor(Math.random() * files.length);
  return files[imgIndex];
}

export const APP_HOME_BUTTONS = new InjectionToken<MenuItem[]>('homeButton');

@Component({
  moduleId: module.id.toString(),
  selector: 'app-page-home',
  templateUrl: 'home.html',
  styleUrls: ['./home.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInAnimation, slideUpDownAnimation]
})
export class HomePage implements OnDestroy {

  private readonly _debug: boolean;
  private _started = false;
  private _subscription = new Subscription();
  private _config: Configuration;

  loading = true;
  waitingNetwork = false;
  showSpinner = true;
  accountName: String = '';
  isLogin: boolean;
  $partners = new BehaviorSubject<Department[]>(null);
  loadingBanner = true;
  logo: String;
  description: String;
  appName: string;
  isWeb: boolean;
  contentStyle: any;
  pageHistory: HistoryPageReference[] = [];
  offline: boolean;
  $filteredButtons = new BehaviorSubject<MenuItem[]>(undefined);

  get currentLocaleCode(): string {
    return this.loading ? '' :
    (this.translate.currentLang || this.translate.defaultLang).substr(0, 2);
  }

  constructor(
    private accountService: AccountService,
    private modalCtrl: ModalController,
    private translate: TranslateService,
    private toastController: ToastController,
    private configService: ConfigService,
    private platform: PlatformService,
    private cd: ChangeDetectorRef,
    public network: NetworkService,
    public settings: LocalSettingsService,
    @Inject(ENVIRONMENT) protected environment,
    @Inject(APP_LOCALES) public locales: LocaleConfig[],
    @Optional() @Inject(APP_HOME_BUTTONS) public buttons: MenuItem[]
  ) {

    this._debug = !environment.production;
    this.showSpinner = !this.platform.started;
    this.platform.ready().then(() => this.start());
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  async login() {
    const modal = await this.modalCtrl.create({
      component: AuthModal
    });
    return modal.present();
  }

  async register() {
    const modal = await this.modalCtrl.create({
      component: RegisterModal,
      backdropDismiss: false
    });
    return modal.present();
  }

  async logout(event: any) {
    await this.accountService.logout();

    // If was offline, try to reconnect (because can be a forced offline mode)
    if (this.offline) {
      await this.tryOnline();
    }
  }

  changeLanguage(locale: string) {
    this.settings.apply({locale})
      .then(() => {
        this.markForCheck();
      });
  }

  getPagePath(page: HistoryPageReference) {
    return page && page.path;
  }


  tryOnline() {
    this.waitingNetwork = true;
    this.markForCheck();

    this.network.tryOnline({
      showLoadingToast: false,
      showOnlineToast: true,
      showOfflineToast: false
    })
      .then(() => {
        this.waitingNetwork = false;
        this.markForCheck();
      });

  }

  /* -- protected method  -- */

  protected async start() {
    await this.accountService.ready();

    this.isLogin = this.accountService.isLogin();
    if (this.isLogin) {
      this.onLogin(this.accountService.account);
    }

    this.offline = this.network.offline;

    // Listen login/logout events
    this._subscription.add(this.accountService.onLogin.subscribe(account => this.onLogin(account)));
    this._subscription.add(this.accountService.onLogout.subscribe(() => this.onLogout()));

    // Listen pod config
    this._subscription.add(this.configService.config.subscribe(config => this.onConfigLoaded(config)));

    // Listen settings changes
    this._subscription.add(
      this.settings.onChange
        .pipe(
          // Add a delay, to avoid to apply changes to often
          debounceTime(3000),
          // Start with current settings
          startWith(await this.settings.ready())
        )
        .subscribe(res => this.onSettingsChanged(res)));

    // Listen network changes
    this._subscription.add(
      this.network.onNetworkStatusChanges
        .pipe(
          //debounceTime(450),
          //tap(() => this.waitingNetwork = false),
          map(connectionType => connectionType === 'none'),
          distinctUntilChanged()
        )
        .subscribe(offline => {
          this.offline = offline;
          this.markForCheck();
        })
    );

    this._started = true;
  }

  protected async showToast(opts: ShowToastOptions) {
    await Toasts.show(this.toastController, this.translate, opts);
  }

  protected onConfigLoaded(config: Configuration) {
    console.debug('[home] Applying configuration', config);
    this._config = config;

    this.appName = config.label || this.environment.defaultAppName || 'SUMARiS';
    this.logo = config.largeLogo || config.smallLogo || undefined;
    this.description = config.name;
    this.isWeb = this.platform.isWebOrDesktop();

    const partners = (config.partners || []).filter(p => p && p.logo);
    this.$partners.next(partners);
    this.loadingBanner = (partners.length === 0);

    // If not already set, compute the background image
    if (!this.contentStyle) {
      const backgroundImages = (config.backgroundImages || [])
        // Filter on not nil, because can occur if detected has not exists (see config-service.js)
        .filter(img => isNotNil(img)
          // If offline, filter on local dataURL image
          && (!this.offline || !img.startsWith('http')));

      // Background image found: select one randomly
      if (backgroundImages.length) {
        const bgImage = getRandomImage(backgroundImages);
        this.contentStyle = bgImage && {'background-image': `url(${bgImage})`} || {};
      }

      // Use background color
      else {
        const primaryColor = config.properties && config.properties['sumaris.color.primary'] || 'var(--ion-color-primary)';
        this.contentStyle = primaryColor && {'background-color': primaryColor} || {};
      }
    }

    this.refreshButtons();
    this.markForCheck();

    // If first load, hide the loading indicator
    if (this.loading) {
      setTimeout(() => {
        this.loading = false;
        this.markForCheck();
      }, 500); // Add a delay, for animation
    }
  }

  protected onSettingsChanged(settings: LocalSettings) {
    if (settings.pageHistory !== this.pageHistory) {
      console.debug('[home] Page history loaded');
      this.pageHistory = settings.pageHistory || [];
    }
    // Always force a refresh (same history array, but content may have changed)
    this.markForCheck();
  }

  protected onLogin(account: Account) {
    if (!account) return; // Skip
    //console.debug('[home] Logged account: ', account);
    this.isLogin = true;
    this.accountName = accountToString(account);
    this.refreshButtons();
    this.markForCheck();
  }

  protected onLogout() {
    this.isLogin = false;
    this.accountName = '';
    this.pageHistory = [];
    this.refreshButtons();
    this.markForCheck();
  }

  protected refreshButtons() {
    if (!this._config) return; // Skip (waiting config to be loaded)
    if (this._debug) console.debug('[home] Refreshing buttons...');

    const filteredButtons = (this.buttons || [])
      .filter((item) => MenuItems.checkIfVisible(item, this.accountService, this._config, {
        isLogin: this.isLogin,
        debug: this._debug,
        logPrefix: '[home]'
      }))
      .map(item => {
        // Replace title using properties
        if (isNotNilOrBlank(item.titleProperty) && this._config) {
          const title = this._config.properties[item.titleProperty];
          if (title) return { ...item, title}; // Create a copy, to keep the original item.title
        }
        return item;
      });

    this.$filteredButtons.next(filteredButtons);
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }


}
