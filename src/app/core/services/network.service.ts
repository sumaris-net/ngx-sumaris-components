import {EventEmitter, Inject, Injectable, Optional} from '@angular/core';
import {CryptoService} from './crypto.service';
import {TranslateService} from '@ngx-translate/core';
import {Storage} from '@ionic/storage';
import {Peer} from './model/peer.model';
import {LocalSettings} from './model/settings.model';
import {ModalController, Platform, ToastController} from '@ionic/angular';
import {SelectPeerModal} from '../peer/select-peer.modal';
import {BehaviorSubject, Subject, Subscription, timer} from 'rxjs';
import {LocalSettingsService, SETTINGS_STORAGE_KEY} from './local-settings.service';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {isNotEmptyArray, isNotNilOrBlank, sleep, toBoolean} from '../../shared/functions';
import {Connection, Network} from '@ionic-native/network/ngx';
import {DOCUMENT} from '@angular/common';
import {CacheService} from 'ionic-cache';
import {ShowToastOptions, Toasts} from '../../shared/toasts';
import {distinctUntilChanged, filter, map, mergeMap, tap} from 'rxjs/operators';
import {OverlayEventDetail} from '@ionic/core';
import {NodeInfo} from './network.utils';
import {HttpUtils} from '../../shared/http/http.utils';
import {VersionUtils} from '../../shared/version/versions';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {isInstanceOf} from './model/entity.model';

export type ConnectionType = 'none' | 'wifi' | 'ethernet' | 'cell' | 'unknown' ;

export type AuthTokenType = 'token' | 'basic' | 'basic-and-token';

export function getConnectionType(type: Connection): ConnectionType {
  switch (type) {
    case Connection.NONE:
      return 'none';
    case Connection.WIFI:
      return 'wifi';
    case Connection.CELL:
    case Connection.CELL_2G:
    case Connection.CELL_3G:
    case Connection.CELL_4G:
      return 'cell';
    case Connection.ETHERNET:
      return 'ethernet';
    case Connection.UNKNOWN:
      return 'unknown';
    default:
      return 'ethernet';
  }
}

export declare type NetworkEventType = 'start'|'peerChanged'|'statusChanged'|'resetCache'|'beforeTryOnlineFinish';

const NetworkRefreshTimerPeriod = {
    MOBILE:  1000 * 60 * 10 /* every 10 min */,
    DESKTOP: 1000 * 60 * 5 /* every 5 min */
};

/* -- DEV only (to debug refresh timer)
const NetworkRefreshTimerPeriod = {
    MOBILE:  1000,
    DESKTOP: 1000
}*/

@Injectable({providedIn: 'root'})
export class NetworkService {

  private readonly _debug: boolean;
  private _started = false;
  private _startPromise: Promise<any>;
  private readonly _mobile: boolean;
  private _subscription = new Subscription();
  private _timerSubscription: Subscription;
  private readonly _timerRefreshPeriod: number;
  private readonly _timerRefreshCondition: () => boolean;
  private _peer: Peer;
  private _deviceConnectionType: ConnectionType;
  private _forceOffline: boolean;
  private _listeners: {
   [key: string]: ((data?: any) => Promise<void>)[];
  } = {};


  onStart = new Subject<Peer>();
  onPeerChanges = this.onStart.pipe(
    map(peer => peer && peer.url),
    filter(isNotNilOrBlank),
    distinctUntilChanged<string>()
  );
  onNetworkStatusChanges = new BehaviorSubject<ConnectionType>(null);
  onResetNetworkCache = new EventEmitter(true);


  get online(): boolean {
    return this.connectionType !== 'none';
  }

  get offline(): boolean {
    return this.connectionType === 'none';
  }

  get connectionType(): ConnectionType{
    // If force offline: return 'none'
    return this._forceOffline && 'none'
      // Else, return device connection type (or unknown)
      || (this._started && this._deviceConnectionType || 'unknown');
  }

  get peer(): Peer {
    return this._peer && this._peer.clone();
  }

  set peer(peer: Peer) {
    this.restart(peer);
  }

  get started(): boolean {
    return this._started;
  }

  constructor(
    @Inject(DOCUMENT) private _document: any,
    private platform: Platform,
    private modalCtrl: ModalController,
    private cryptoService: CryptoService,
    private storage: Storage,
    private settings: LocalSettingsService,
    private cache: CacheService,
    private http: HttpClient,
    @Inject(ENVIRONMENT) protected environment,
    @Optional() private network: Network,
    @Optional() private splashScreen: SplashScreen,
    @Optional() private translate: TranslateService,
    @Optional() private toastController: ToastController
  ) {
    this._mobile = this.platform.is('mobile');

    if (this._mobile) {
      this._timerRefreshPeriod = NetworkRefreshTimerPeriod.MOBILE;
      this._timerRefreshCondition = () => this.online; // Check only when online, and stop when offline
    }
    else {
      this._timerRefreshPeriod = NetworkRefreshTimerPeriod.DESKTOP;
      this._timerRefreshCondition = () => true; // Always check
    }

    this.resetData();

    // For DEV only
    this._debug = !environment.production;

  }

  /**
   * Register to network event
   *
   * @param eventType
   * @param callback
   */
  on<T= any>(eventType: NetworkEventType, callback: (data?: T) => Promise<void>): Subscription {
    switch (eventType) {
      case 'start':
        return this.onStart.subscribe(() => callback());

      case 'peerChanged':
        return this.onPeerChanges.subscribe(() => callback());

      case 'statusChanged':
        return this.onNetworkStatusChanges.subscribe((type) => callback(type as unknown as T));

      case 'resetCache':
        return this.onResetNetworkCache.subscribe(() => callback());

      default:
        return this.addListener(eventType, callback);
    }
  }


  async start(peer?: Peer): Promise<any> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return;

    console.info('[network] Starting network...');

    // Restoring local settings
    this._startPromise = (!peer && this.restoreLocally() || Promise.resolve(peer))
      .then(async (peer: Peer | undefined) => {

        // Make sure to hide the splashscreen, before open the modal
        if (!peer && this.splashScreen) this.splashScreen.hide();

        // No peer in settings: ask user to choose
        while (!peer) {
          console.debug('[network] No peer defined. Asking user to choose a peer.');
          peer = await this.showSelectPeerModal({allowSelectDownPeer: false});
        }
        this._peer = peer;
        this._started = true;
        this._startPromise = undefined;

        this.onStart.next(peer);
        console.info(`[platform] Starting network [OK] {online: ${this.online}}`);
      })
      .catch((err) => {
        console.error(err && err.message || err, err);
        this._started = false;
        this._startPromise = undefined;
      })

      // Wait settings starts, then save peer in settings
      .then(() => this.settings.ready())
      .then(() => this.settings.apply({peerUrl: this._peer.url}))
      .then(() => this.onDeviceConnectionChanged(this.network && this.network.type || 'unknown'))

      // Start the refresh timer
      .then(() => this.startRefreshTimer());

    // Listen for device network changes
    if (this.network) {
      this._subscription.add(this.network.onDisconnect().subscribe(() => this.onDeviceConnectionChanged('none')));
      this._subscription.add(this.network.onConnect().subscribe(() => this.onDeviceConnectionChanged(this.network.type)));
    }


    return this._startPromise;
  }

  ready(): Promise<void> {
    if (this._started) return Promise.resolve();
    return this.start();
  }

  async stop() {
    this.resetData();
    this._started = false;
    this._startPromise = undefined;

    // Stop timer if cannot refresh anymore
    if (this._timerRefreshCondition() === false) {
      this.stopRefreshTimer();
    }

    this._subscription.unsubscribe();
    this._subscription = new Subscription();
  }

  async restart(peer?: Peer) {
    if (this._started) {
      await this.stop()
        .then(() => this.start(peer));
    } else {
      await this.start(peer);
    }
  }

  async tryOnline(opts?: {
    showOfflineToast?: boolean;
    showOnlineToast?: boolean;
    showLoadingToast?: boolean;
    afterRetryDelay?: number;
    afterRetryPromise?: () => Promise<any>;
  }): Promise<boolean> {
    // If offline mode not forced, and device says there is no connection: skip
    if (!this._forceOffline || this._deviceConnectionType === 'none') return false;

    // SHow loading toast
    const now = Date.now();
    const showLoadingToast = !opts || opts.showLoadingToast !== false;
    let loadingToast: HTMLIonToastElement;
    if (showLoadingToast) {
      await this.showToast({message: 'NETWORK.INFO.RETRY_TO_CONNECT',
        duration: 10000,
        onWillPresent: t => loadingToast = t});
    }

    try {
      console.info('[network] Checking connection to pod...');
      const settings: LocalSettings = await this.settings.ready();

      if (!settings.peerUrl) return false; // No peer define. Skip

      const peer = Peer.parseUrl(settings.peerUrl);
      const peerInfo = await this.checkPeerAlive(peer);
      const peerAliveAndCompatible = peerInfo && await this.checkPeerCompatible(peerInfo);
      if (peerAliveAndCompatible) {

        // Disable the offline mode
        this.setForceOffline(false);

        // Restart
        await this.restart(peer);

        // Wait a promise, before recheck
        await this.emit('beforeTryOnlineFinish', this.online);

      }
    }
    catch (err) {
      console.error(err && err.message || err);
      // Continue
    }

    // Close loading toast (with a minimal display duration of 2s)
    if (showLoadingToast) {
      await sleep(2000 - (Date.now() - now));
      if (loadingToast) await loadingToast.dismiss();
    }

    // Recheck network status
    const online = this.online;

    // Display a toast to user
    if (online) {
      if (!opts || opts.showOnlineToast !== false) {
        // Display toast (without await, because not need to wait toast close event)
        this.showToast({message: 'NETWORK.INFO.ONLINE', type: 'info'});
      }
    }
    else if (opts && opts.showOfflineToast === true) {
      // Display toast (without await, because not need to wait toast close event)
      return this.showOfflineToast({showRetryButton: false});
    }

    return this._started && online;
  }

  async showOfflineToast(opts?: {
    message?: string;
    showCloseButton?: boolean;
    showRetryButton?: boolean;
    showRetrySuccessToast?: boolean;
    showRetryLoadingToast?: boolean;
    onRetrySuccess?: () => void;
  }): Promise<boolean> {
    if (this.online) return; // Skip if online

    // Toast with a retry button
    if (!opts || opts.showRetryButton !== false) {

      const toastResult = await this.showToast({
        message: (opts && opts.message || 'ERROR.NETWORK_REQUIRED'),
        type: 'warning',
        showCloseButton: true,
        duration: 100000,
        buttons: [
          // reconnect button
          {
            role: 'refresh',
            text: this.translate.instant('NETWORK.BTN_CHECK_ALIVE')
          }
        ]
      });

      // User don't click reconnect: return
      if (!toastResult || toastResult.role !== 'refresh') return false;

      // if network state changed to online: exit here
      if (this.online) return true;

      // Try to reconnect
      const online = await this.tryOnline({
        showOfflineToast: false,
        showOnlineToast: toBoolean(opts && opts.showRetrySuccessToast, true),
        showLoadingToast: toBoolean(opts && opts.showRetryLoadingToast, true)
      });
      if (online) {
        // Call success callback (async)
        if (opts && opts.onRetrySuccess) {
          setTimeout(opts.onRetrySuccess);
        }
        return true;
      }

      opts = {
        ...opts,
        showRetryButton: false,
        showCloseButton: true
      };
    }

    // Simple toast, without 'await', because not need to wait toast's dismiss
    this.showToast({
      message: 'ERROR.NETWORK_REQUIRED',
      type: 'error',
      ...opts
    });

    return false;
  }

  /**
   * Try to restore peer from the local storage
   */
  async restoreLocally(): Promise<Peer | undefined> {

    // Restore from storage
    const settingsStr = await this.storage.get(SETTINGS_STORAGE_KEY);
    const settings = settingsStr && JSON.parse(settingsStr) || undefined;
    if (settings && settings.peerUrl) {
      console.debug(`[network] Use peer {${settings.peerUrl}} (found in the local storage)`);
      return Peer.parseUrl(settings.peerUrl);
    }

    // Else, use default peer in env, if exists
    if (this.environment.defaultPeer) {
      return Peer.fromObject(this.environment.defaultPeer);
    }

    // Else, if App is hosted, try the web site as a peer
    const location = this._document && this._document.location;
    if (location && location.protocol && location.protocol.startsWith('http')) {
      const hostname = this._document.location.host;
      const detectedPeer = Peer.parseUrl(`${this._document.location.protocol}${hostname}${this.environment.baseUrl}`);
      if (await this.checkPeerAlive(detectedPeer)) {
        return detectedPeer;
      }
    }

    return undefined;
  }

  /**
   * Refresh network state, using a ping to pod
   */
  async refreshPeerState(opts?: {
      displayToast?: boolean; // Display a toast ?
    }) {

  }

  /**
   * Stop to network state
   *
   * @protected
   */
  protected stopRefreshTimer() {
    if (this._timerSubscription) {
      this._timerSubscription.unsubscribe();
      this._timerSubscription = undefined;
    }
  }

  /**
   * Refresh the network state
   *
   * @protected
   */
  protected startRefreshTimer(){
    if (this._timerSubscription) return; // Already running: skip

    console.info(`[network] Starting refresh timer, every ${this._timerRefreshPeriod}ms...`);

    let lastInfo: NodeInfo;
    this._timerSubscription = timer(this._timerRefreshPeriod, this._timerRefreshPeriod)
      .pipe(
        // Skip some timer event (see constructor)
        filter(this._timerRefreshCondition),

        // Checkin if peer alive
        tap(() =>  console.debug('[network] Checking connection to pod...')),
        mergeMap(() => this.checkPeerAlive(this.peer)),

        // Filter to keep only changes
        filter(info => !!info !== !!lastInfo),
        tap(info => lastInfo = info),

        // Check compatibility
        mergeMap((info) => this.checkPeerCompatible(info, {showToast: true})),
      )
      .subscribe(alive => {
          if (alive && this.offline) {
            this.setForceOffline(false);

            // Restart the service (to force re auth)
            this.restart();
          }
          else if (!alive && this.online){
            this.setForceOffline(true);

            // Stop the service
            this.stop();
          }
        });

    this._timerSubscription.add(() => console.debug('[network] Refresh timer stopped'));
  }

  /**
   * Check if the peer is alive
   *
   * @param email
   */
  async checkPeerAlive(peer?: string | Peer, opts?: { checkCompatible?: boolean; displayToast?: boolean } ): Promise<NodeInfo> {
    peer = peer || this.peer;
    if (!peer) {
      const settings: LocalSettings = await this.settings.ready();
      if (!settings.peerUrl) return undefined; // No peer define. Skip
      peer = Peer.parseUrl(settings.peerUrl);
    }

    try {
      return await this.getNodeInfo(peer);
    } catch (err) {
      console.debug('[network] Cannot get /api/node/info from peer');
      return undefined;
    }
  }

  async checkPeerCompatible(peerInfo: NodeInfo, opts?: { showToast?: boolean }): Promise<boolean> {
    if (!this.environment.peerMinVersion) return true; // Skip compatibility check

    // Check the min pod version, defined by the app
    const isCompatible = peerInfo && peerInfo.softwareVersion && VersionUtils.isCompatible(this.environment.peerMinVersion, peerInfo.softwareVersion);

    // Display toast, if not compatible
    if (!isCompatible && (!opts || opts.showToast !== false)) {
      await this.showToast({
        type: 'error',
        message: 'NETWORK.ERROR.NOT_COMPATIBLE_PEER',
        messageParams: {
          version: this.environment.peerMinVersion
        },
        showCloseButton: true
      });
    }
    return isCompatible;
  }

  getNodeInfo(peer?: string | Peer): Promise<NodeInfo> {
    peer = peer || this.peer;

    if (!peer) return undefined;

    let peerUrl = isInstanceOf(peer, Peer) ? peer.url : (peer as string);
    // Remove trailing slash
    if (peerUrl.endsWith('/')) {
      peerUrl = peerUrl.substr(0, peerUrl.length - 1);
    }
    return this.get(peerUrl + '/api/node/info');
  }

  /**
   * Allow to force offline mode
   */
  setForceOffline(value?: boolean, opts?: {
    showToast?: boolean; // Display a toast, when offline ?
  }) {
    value = toBoolean(value, true);
    if (this._forceOffline !== value) {
      const previousConnectionType = this.connectionType;
      this._forceOffline = value;
      const currentConnectionType = this.connectionType;

      if (previousConnectionType !== currentConnectionType) {
        console.info(`[network] Connection changed to {${currentConnectionType}}`);
        this.onNetworkStatusChanges.next(currentConnectionType);

        // Offline mode: alert the user
        if (currentConnectionType === 'none' && (!opts || opts.showToast !== false)) {
          this.showToast({message: 'NETWORK.INFO.OFFLINE_HELP'});
        }
      }
    }
  }

  async showSelectPeerModal(opts?: {allowSelectDownPeer?: boolean; canCancel?: boolean}): Promise<Peer | undefined> {

    opts = opts || {};

    const $onRefresh = new EventEmitter<UIEvent>();
    const peers$ = $onRefresh.pipe(
      mergeMap((_) => this.getDefaultPeers()),
      map(peers => peers || [])
    );

    const modal = await this.modalCtrl.create({
      component: SelectPeerModal,
      componentProps: {
        onRefresh: $onRefresh,
        peers: peers$,
        canCancel: toBoolean(opts.canCancel, true),
        allowSelectDownPeer: toBoolean(opts.allowSelectDownPeer, true)
      },
      keyboardClose: true,
      showBackdrop: true
    });
    await modal.present();
    $onRefresh.emit();

    const { data } = await modal.onWillDismiss();
    $onRefresh.complete();

    return data && (data as Peer) || undefined;
  }

  async clearCache(opts?: { emitEvent?: boolean }): Promise<void> {

    const now = this._debug && Date.now();

    console.info('[network] Clearing all caches...');
    return this.cache.clearAll()
      .then(() => {
        // Emit event
        if (!opts || opts.emitEvent !== false && this.onResetNetworkCache.observers.length) {
          this.onResetNetworkCache.emit();

          // Wait observers clean their caches, if need
          return setTimeout(() => {/*empty*/}, 500);
          return setTimeout(() => {/*empty*/}, 500);
        }
      })
      .then(() => {
        if (this._debug) console.debug(`[network] All cache cleared, in ${Date.now() - now}ms`);
      });
  }

  protected async get<T>(path: string, opts?: {
    headers?: HttpHeaders | {
      [header: string]: string | string[];
    };
  }): Promise<T> {

    let uri = path;

    // If path is not an URI: prepend with peer URL
    if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
      let peerUrl = (this.peer && this.peer.url);

      // Remove trailing slash
      if (peerUrl.endsWith('/')) {
        peerUrl = peerUrl.substr(0, peerUrl.length - 1 );
      }

      // Add first path
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      // Create the URI: concat peer URL and path
      uri = peerUrl + path;
    }

    try {
      // Execute the request
      return HttpUtils.getResource(this.http, uri, opts);
    }
    catch (err) {
      if (err && err.message) {
        console.error('[network] ' + err.message, err);
      }
      else {
        console.error(`[network] Error on get request ${uri}: ${err && err.statusText}`);
      }
      throw {code: err.status, message: 'ERROR.UNKNOWN_NETWORK_ERROR'};
    }
  }


  /* -- Protected methods -- */

  protected onDeviceConnectionChanged(connectionType?: string) {
    connectionType = (connectionType || 'unknown').toLowerCase();
    if (connectionType.startsWith('cell')) connectionType = 'cell';
    if (connectionType !== this._deviceConnectionType) {
      this._deviceConnectionType = connectionType as ConnectionType;

      // If NOT  already forced as offline, emit event
      if (!this._forceOffline) {
        console.info(`[network] Connection changed to {${this._deviceConnectionType}}`);
        this.onNetworkStatusChanges.next(this._deviceConnectionType);

        // Change to offline
        if (this._deviceConnectionType === 'none') {
          if (this._mobile) {
            // Force offline mode
            this._forceOffline = true;

            // Alert the user
            this.showToast({message: 'NETWORK.INFO.OFFLINE_HELP'});
          }
          else {
            // Alert the user
            this.showToast({message: 'NETWORK.INFO.OFFLINE'});
          }

          // Stop the network service
          this.stop();
        }
      }
    }
  }

  protected resetData() {
    this._peer = null;
  }



  /**
   * Get default peers, from environment
   */
  protected async getDefaultPeers(): Promise<Peer[]> {
    const peers = (this.environment.defaultPeers || []).map(Peer.fromObject);
    return Promise.resolve(peers);
  }

  protected showToast<T = any>(opts: ShowToastOptions): Promise<OverlayEventDetail<T>> {
    return Toasts.show(this.toastController, this.translate, opts);
  }

  protected addListener<T= any>(name: NetworkEventType, callback: (data?: T) => Promise<void>): Subscription {
    this._listeners[name] = this._listeners[name] || [];
    this._listeners[name].push(callback);

    // When unsubcribe, remove from the listener
    return new Subscription(() => {
      const index = this._listeners[name].indexOf(callback);
      if (index !== -1) {
        this._listeners[name].splice(index, 1);
      }
    });
  }

  protected async emit<T= any>(name: NetworkEventType, data?: T) {
    const hooks = this._listeners[name];
    if (isNotEmptyArray(hooks)) {
      console.info(`[network-service] Trigger ${name} hook: Executing ${hooks.length} callbacks...`);

      return Promise.all(hooks.map(callback => {
        const promise = callback(data);
        if (!promise) return;
        return promise.catch(err => console.error('Error while executing hook ' + name, err));
      }));
    }
  }
}
