import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {Subscription} from 'rxjs';
import {Configuration} from '../services/model/config.model';
import {ConfigService} from '../services/config.service';
import {PlatformService} from '../services/platform.service';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {NetworkService} from '../services/network.service';
import {CORE_CONFIG_OPTIONS} from '../services/config/core.config';
import {VersionUtils} from '../../shared/version/versions';
import {fadeInAnimation, slideUpDownAnimation} from '../../shared/material/material.animations';
import {isNilOrBlank, isNotEmptyArray, isNotNilOrBlank} from '../../shared/functions';
import {ENVIRONMENT} from '../../../environments/environment.class';


export declare interface InstallAppLink {
  name: string;
  url: string;
  platform?: 'android' | 'ios';
  version?: string;
  downloadFilename?: string;
}

@Component({
  selector: 'app-install-upgrade-card',
  templateUrl: 'install-upgrade-card.component.html',
  styleUrls: ['./install-upgrade-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [slideUpDownAnimation]
})
export class AppInstallUpgradeCard implements OnInit, OnDestroy {

  private _subscription = new Subscription();
  private _showUpdateOfflineFeature = false;

  loading = true;
  waitingNetwork = false;
  allLinks: InstallAppLink[];
  installLinks: InstallAppLink[];
  updateLinks: InstallAppLink[];
  offline: boolean;
  upgradeVersion: string;


  @Input()
  isLogin: boolean;


  @Input()
  showUpgradeWarning = true;

  @Input()
  showOfflineWarning = true;

  @Input()
  showInstallButton = false;

  @Input()
  set showUpdateOfflineFeature(value: boolean) {
    if (value === this._showUpdateOfflineFeature) return; // Skip
    this._showUpdateOfflineFeature = value;
    this.markForCheck();
  }

  get showUpdateOfflineFeature(): boolean {
    return this._showUpdateOfflineFeature;
  }

  @Output()
  onUpdateOfflineModeClick = new EventEmitter<UIEvent>();

  constructor(
    private modalCtrl: ModalController,
    private configService: ConfigService,
    private platform: PlatformService,
    private cd: ChangeDetectorRef,
    public network: NetworkService,
    @Inject(ENVIRONMENT) protected environment
  ) {

  }

  async ngOnInit() {

    await this.platform.ready();

    this.offline = this.network.offline;

    // Listen pod config
    this._subscription.add(
      this.configService.config
        .subscribe(config => {
          console.info('[install] Checking if upgrade  or install is need...');

          const installLinks = this.getAllInstallLinks(config);

          // Check for upgrade
          this.updateLinks = this.getCompatibleUpgradeLinks(installLinks, config);

          // Check for install links (if no upgrade need)
          this.installLinks = !this.updateLinks && this.getCompatibleInstallLinks(installLinks);

          setTimeout(() => {
            this.loading = false;
            this.markForCheck();
          }, 2000); // Add a delay, for animation
        }));

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
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  openDownloadLink(event: UIEvent, url: string) {
    if (!url) return; // Skip

    if (event) {
      event.preventDefault();
    }

    console.info(`[install] Opening App download link: ${url}`);
    this.platform.open(url, '_system', 'location=yes');
    return false;
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

  getPlatformName(platform: 'android'|'ios') {
    switch (platform) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      default:
        return '';
    }
  }

  getAppFileName(): string {
    return;
  }

  /* -- protected method  -- */

  private getCompatibleInstallLinks(installLinks: InstallAppLink[]): InstallAppLink[] {

    // Cordova already running: not need to install
    if (this.platform.is('cordova')) return undefined;

    // If mobile web: return all
    if (this.platform.is('mobileweb')) {
      return installLinks;
    }

    return undefined;
  }

  private getCompatibleUpgradeLinks(installLinks: InstallAppLink[], config: Configuration): InstallAppLink[] {
    const appMinVersion = config.getProperty(CORE_CONFIG_OPTIONS.APP_MIN_VERSION);

    const needUpgrade = appMinVersion && !VersionUtils.isCompatible(appMinVersion, this.environment.version);
    if (!needUpgrade) return undefined;

    const upgradeLinks = installLinks
      .filter(link => this.platform.is('mobileweb') || (link.platform &&  this.platform.is(link.platform)));

    // Use min version as default version
    upgradeLinks.forEach(link => {
      link.version = link.version || appMinVersion;
    });

    return isNotEmptyArray(upgradeLinks) ? upgradeLinks : undefined;
  }

  private getAllInstallLinks(config: Configuration): InstallAppLink[] {
    const result: InstallAppLink[] = [];

    // Android
    {
      // Get URL (from config, or environment)
      let url = config.getProperty(CORE_CONFIG_OPTIONS.ANDROID_INSTALL_URL);
      if (isNilOrBlank(url)) url = this.environment.defaultAndroidInstallUrl || null;

      // Compute App name
      const name: string = isNotNilOrBlank(url) && config.label || this.environment.defaultAppName || 'SUMARiS';

      if (url) {
        let downloadFilename: string;
        let version;

        // Get file name
        const filename = this.getFilename(url);
        version = config.getProperty(CORE_CONFIG_OPTIONS.APP_MIN_VERSION);

        // OK, this is a downloadable APK file (e.g. NOT a link to a playstore)
        if (filename?.endsWith('.apk')) {

          // Get the file version (if any)
          const versionMatches = /-v([1-9][0-9]*\.[0-9]+\.(:?(:?alpha|beta|rc)?[0-9]*))/i.exec(filename);
          version = versionMatches && versionMatches[1] || version;

          // Compute a new file name, with the version
          if (isNotNilOrBlank(name)) {
            downloadFilename = `${name}-${version}.apk`;
          }

          else {
            downloadFilename = filename;

            // Replace 'latest' with the app min version
            if (downloadFilename.indexOf('latest')) {
              version = config.getProperty(CORE_CONFIG_OPTIONS.APP_MIN_VERSION);
              downloadFilename = downloadFilename.replace('latest', version);
            }
          }
        }

        result.push({ name, url, platform: 'android', version, downloadFilename });
      }
    }

    // iOS - TODO
    //{
    //  (...)
    //}

    return result;
  }

  protected getFilename(url: string): string {
    if (!url) return;
    // Get last part (or all string, if no '/')
    let filename = url.substring(url.lastIndexOf('/')+1);

    const queryParamIndex = filename.indexOf('?');
    if (queryParamIndex !== -1) {
      // Remove query params
      return filename.substring(0, queryParamIndex);
    }

    return filename;
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
