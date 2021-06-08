import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Inject, InjectionToken, Input, OnInit, Optional, ViewChild} from '@angular/core';
import {AlertController, IonSplitPane, MenuController, ModalController} from '@ionic/angular';

import {Router} from '@angular/router';
import {Account} from '../services/model/account.model';
import {UserProfileLabel} from '../services/model/person.model';
import {Configuration} from '../services/model/config.model';
import {AccountService} from '../services/account.service';
import {AboutModal} from '../about/modal-about';

import {fadeInAnimation} from '../../shared/material/material.animations';
import {TranslateService} from '@ngx-translate/core';
import {isNotNilOrBlank} from '../../shared/functions';
import {BehaviorSubject, merge, Subscription} from 'rxjs';
import {ConfigService} from '../services/config.service';
import {mergeMap, tap} from 'rxjs/operators';
import {HammerSwipeEvent} from '../../shared/gesture/hammer.utils';
import {PlatformService} from '../services/platform.service';
import {IconRef} from '../../shared/types';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {MenuService} from './menu.service';

export interface MenuItem extends IconRef {
  title: string;
  path?: string;
  action?: string | any;
  icon?: string;
  matIcon?: string;
  profile?: UserProfileLabel;
  exactProfile?: UserProfileLabel;
  color?: string;
  cssClass?: string;
  // A config property, to enable the menu item
  ifProperty?: string;
  // A config property, to override the title
  titleProperty?: string;
  titleArgs?: {[key: string]: string};
  children?: MenuItem[];
}

export class MenuItems {
  static checkIfVisible(item: MenuItem,
                        accountService: AccountService,
                        config: Configuration,
                        opts?: {
                          isLogin?: boolean;
                          debug?: boolean;
                          logPrefix?: string;
                        }): boolean {
    opts = opts || {};
    if (item.profile) {
      const hasProfile = accountService.isLogin() && accountService.hasMinProfile(item.profile);
      if (!hasProfile) {
        if (opts.debug) console.debug(`${opts && opts.logPrefix || '[menu]'} Hide item '${item.title}': need the min profile '${item.profile}' to access path '${item.path}'`);
        return false;
      }
    }

    else if (item.exactProfile) {
      const hasExactProfile =  accountService.hasExactProfile(item.exactProfile);
      if (!hasExactProfile) {
        if (opts.debug) console.debug(`${opts && opts.logPrefix || '[menu]'} Hide item '${item.title}': need exact profile '${item.exactProfile}' to access path '${item.path}'`);
        return false;
      }
    }

    // If enable by config
    if (item.ifProperty) {
      //console.debug("[menu] Checking if property enable ? " + item.ifProperty, config && config.properties);
      const isEnableByConfig = config && config.properties[item.ifProperty] === 'true';
      if (!isEnableByConfig) {
        if (opts.debug) console.debug('[menu] Config property \'' + item.ifProperty + '\' not \'true\' for ', item.path);
        return false;
      }
    }

    return true;
  }
}

export const APP_MENU_ROOT = new InjectionToken<MenuItem[]>('menuRoot');
export const APP_MENU_ITEMS = new InjectionToken<MenuItem[]>('menuItems');

const SPLIT_PANE_SHOW_WHEN = 'lg';

@Component({
  selector: 'app-menu',
  templateUrl: 'menu.component.html',
  styleUrls: ['./menu.component.scss'],
  animations: [fadeInAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuComponent implements OnInit {

  private readonly _debug: boolean;
  private _subscription = new Subscription();
  private _config: Configuration;
  private _screenWidth: number;

  public loading = true;
  public isLogin = false;
  accountName: string;
  accountAvatar: string;
  accountEmail: string;

  public splitPaneOpened: boolean;

  @Input() logo: String;

  @Input() appName: String;

  $filteredItems = new BehaviorSubject<MenuItem[]>(undefined);

  @Input()
  appVersion: String = this.environment.version;

  @Input() side = 'left';

  @ViewChild('splitPane', { static: true }) splitPane: IonSplitPane;

  constructor(
    protected platformService: PlatformService,
    protected accountService: AccountService,
    protected router: Router,
    protected menu: MenuController,
    protected modalCtrl: ModalController,
    protected alertController: AlertController,
    protected translate: TranslateService,
    protected configService: ConfigService,
    protected cd: ChangeDetectorRef,
    protected menuService: MenuService,
    @Inject(ENVIRONMENT) protected environment,
    @Optional() @Inject(APP_MENU_ITEMS) public items: MenuItem[]
  ) {

    this._debug = !environment.production;

    this.onResize();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?: UIEvent) {
    this._screenWidth = window.innerWidth;
    console.debug('[menu] Screen size (px): ' + this._screenWidth);
  }

  async ngOnInit() {
    this.splitPaneOpened = true;
    this.splitPane.when = SPLIT_PANE_SHOW_WHEN;

    // Wait platform started
    await this.platformService.ready();

    this.splitPaneOpened = true;

    // Listen to menu service event
    this.menuService.menuToggled$
      .subscribe(() => this.toggleSplitPane());

    // Update component when refresh is need (=login events or config changed)
    this._subscription.add(
      merge(
        this.accountService.onLogin,
        this.accountService.onLogout,
        this.configService.config
          .pipe(
            tap(config => this._config = config)
          )
      )
        .pipe(
          // Wait account service ready (can be restarted)
          mergeMap(() => this.accountService.ready()),
          //debounceTime(200)
        )
        .subscribe(account => {
          if (this.accountService.isLogin()) {
            this.onLogin(this.accountService.account);

          } else {
            this.onLogout(true);
          }
        }));
  }

  async onLogin(account: Account) {
    console.info('[menu] Update using logged account');
    this.accountAvatar = account.avatar;
    this.accountName = account.displayName;
    this.accountEmail = account.email;
    this.isLogin = true;
    await this.refreshMenuItems();

    setTimeout(() => {
      this.loading = false;
      this.detectChanges();
    }, 500);
  }

  async onLogout(skipRedirect?: boolean) {
    if (!skipRedirect) console.debug('[menu] logout');
    this.isLogin = false;
    //this.splitPaneOpened = false;
    //this.splitPane.when = false;
    this.accountAvatar = null;
    this.accountEmail = null;
    this.accountName = null;
    await this.refreshMenuItems();

    // Wait the end of fadeout, to reset the account
    if (!skipRedirect) {
      await this.router.navigate(['']);
    }

    //setTimeout(() => {
    this.loading = false;
    this.detectChanges();
    //}, 1000);

  }

  async logout() {

    const translations = await this.translate.get([
      'AUTH.LOGOUT.CONFIRM_TITLE',
      'AUTH.LOGOUT.CONFIRM_MESSAGE',
      'COMMON.BTN_CANCEL',
      'AUTH.LOGOUT.BTN_CONFIRM'
    ]).toPromise();
    const alert = await this.alertController.create({
      header: translations['AUTH.LOGOUT.CONFIRM_TITLE'],
      message: translations['AUTH.LOGOUT.CONFIRM_MESSAGE'],
      buttons: [
        {
          text: translations['COMMON.BTN_CANCEL'],
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: translations['AUTH.LOGOUT.BTN_CONFIRM'],
          cssClass: 'ion-color-primary',
          handler: () => {
            this.accountService.logout();

            setTimeout(() => 
              // Back to home
               this.router.navigateByUrl('/', {replaceUrl: true /* will clear router history */})
            , 100);
          }
        }
      ]
    });

    await alert.present();
  }

  async menuClose(): Promise<boolean> {
    return this.menu.close('left');
  }

  async openAboutModal(event) {
    const modal = await this.modalCtrl.create({component: AboutModal});
    return modal.present();
  }

  toggleSplitPane(event?: MouseEvent) {
    if (event && event.defaultPrevented) return;
    if (event) event.preventDefault();

    this.splitPaneOpened = !this.splitPaneOpened;
    if (!this.splitPaneOpened) {
      this.splitPane.when = false;
    } else {
      this.splitPane.when = SPLIT_PANE_SHOW_WHEN;
    }
    this.menuService.menuVisible(this.splitPaneOpened);

    this.detectChanges();
  }

  async doAction(action: string, event: UIEvent) {
    this.menuClose();

    switch (action) {
      case 'logout':
        await this.logout();
        break;
      case 'about':
        await this.openAboutModal(event);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
  }

  onSwipeRight(event: HammerSwipeEvent) {
    // Skip, if not a valid swipe event
    if (!event || event.pointerType !== 'touch' || event.velocity < 0.4) {
      //event.preventDefault();
      return false;
    }

    // Will open the left menu, so cancelled this swipe event
    const startX =  event.center.x - event.distance;
    if (startX <= 50) {
      // DEBUG
      //console.debug("[menu] Cancel swipe right, because near the left menu {x: " + startX + ", velocity: " + event.velocity + "}");
      event.preventDefault();
      return false;
    }

    // OK: continue

    // DEBUG
    //console.debug("[menu] Received swipe right {x: " + startX + ", velocity: " + event.velocity + "}");
  }

  /* -- protected methods -- */

  protected refreshMenuItems() {
    if (this._debug) console.debug('[menu] Refreshing menu items...');

    const filteredItems = (this.items || [])
      .filter((item) => MenuItems.checkIfVisible(item, this.accountService, this._config, {
        isLogin: this.isLogin,
        debug: this._debug
      }))
      .map(item => {
        // Replace title using properties
        if (isNotNilOrBlank(item.titleProperty) && this._config) {
          const title = this._config.properties[item.titleProperty];
          if (title) return { ...item, title}; // Create a copy, to keep the original item.title
        }
        return item;
      });

    this.$filteredItems.next(filteredItems);
  }

  protected detectChanges() {
    this.cd.detectChanges();
  }
}

