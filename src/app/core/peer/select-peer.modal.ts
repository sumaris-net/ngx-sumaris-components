import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  EventEmitter,
  Output,
  Inject
} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {Peer} from '../services/model/peer.model';
import {Observable, Subject, Subscription} from 'rxjs';
import {fadeInAnimation} from '../../shared/material/material.animations';
import {HttpClient} from '@angular/common/http';
import {NetworkUtils, NodeInfo} from '../services/network.utils';
import {VersionUtils} from '../../shared/version/versions';
import {ENVIRONMENT} from '../../../environments/environment.class';

@Component({
  selector: 'select-peer-modal',
  templateUrl: 'select-peer.modal.html',
  styleUrls: [ './select-peer.modal.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInAnimation]
})
export class SelectPeerModal implements OnDestroy {

  private _subscription = new Subscription();
  loading = true;
  $peers = new Subject<Peer[]>();
  peerMinVersion = this.environment.peerMinVersion;

  @Input() canCancel = true;
  @Input() allowSelectDownPeer = true;
  @Input() onRefresh = new EventEmitter<UIEvent>();

  constructor(

    private viewCtrl: ModalController,
    private cd: ChangeDetectorRef,
    private http: HttpClient,
    @Inject(ENVIRONMENT) protected environment
  ) {
  }

  set peers(peers: Observable<Peer[]>) {
    this._subscription.add(
      peers.subscribe(res => this.refreshPeers(res))
    );
  }

  cancel() {
    this.viewCtrl.dismiss();
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }

  selectPeer(peer: Peer) {
    if (this.allowSelectDownPeer || (peer.reachable && this.isCompatible(peer))) {
      console.debug(`[select-peer-modal] Selected peer: {url: '${peer.url}'}`);
      this.viewCtrl.dismiss(peer);
    }
  }


  /**
   *  Check the min pod version, defined by the app
   *
   * @param peer
   */
  isCompatible(peer: Peer): boolean {
    return !this.peerMinVersion || (peer && peer.softwareVersion && VersionUtils.isCompatible(this.peerMinVersion, peer.softwareVersion));
  }

  refresh(event: UIEvent) {
    this.loading = true;
    this.onRefresh.emit(event);
  }

  /* -- protected methods -- */

  async refreshPeers(peers: Peer[]) {
    peers = peers || [];

    const data: Peer[] = [];
    const jobs = Promise.all(
      peers.map(async (peer) => {
        await this.refreshPeer(peer);

        if (this._subscription.closed) return; // component destroyed

        data.push(peer);

        // Sort (by reachable, then host)
        data.sort((a, b) => {
          if (a.reachable && !b.reachable) return -1;
          if (!a.reachable && b.reachable) return 1;
          if (a.hostAndPort < b.hostAndPort) return -1;
          if (a.hostAndPort > b.hostAndPort) return 1;
          return 0;
        });

        this.$peers.next(data);
        return peer;
      }));

    this._subscription.add(
      this.$peers
        .subscribe(() => this.cd.markForCheck())
    );

    try {
      await jobs;
    }
    catch(err) {
      if (!this._subscription.closed) console.error(err);
    }
    this.loading = false;
    this.cd.markForCheck();
  }

  protected async refreshPeer(peer: Peer): Promise<Peer> {
    try {
      const summary: NodeInfo = await NetworkUtils.getNodeInfo(this.http, peer.url);
      peer.status = 'UP';
      peer.softwareName = summary.softwareName;
      peer.softwareVersion = summary.softwareVersion;
      peer.label = summary.nodeLabel;
      peer.name = summary.nodeName;
    } catch (err) {
      if (!this._subscription.closed)  {
        if (err && err.message) {
          console.error('[select-peer] ' + err.message, err);
        }
      }
      peer.status = 'DOWN';
    }
    return peer;
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
