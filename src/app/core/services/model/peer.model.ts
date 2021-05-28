/* -- Network -- */

import {isNilOrBlank, isNotNil, noTrailingSlash} from "../../../shared/functions";
import {Cloneable, Entity, EntityAsObjectOptions} from "./entity.model";
import {EntityClass} from "./entity.decorators";

// @dynamic
@EntityClass({typename: 'PeerVO'})
export class Peer extends Entity<Peer> implements Cloneable<Peer> {

  static fromObject: (source: any, opts?: any) => Peer

  static parseUrl(peerUrl: string) {
    const url = new URL(peerUrl);
    return Peer.fromObject({
      dns: url.hostname,
      port: isNilOrBlank(url.port) ? undefined : url.port,
      useSsl: url.protocol && (url.protocol.startsWith('https') || url.protocol.startsWith('wss')),
      path: noTrailingSlash(url.pathname)
    });
  }

  dns: string;
  ipv4: string;
  ipv6: string;
  port: number;
  useSsl: boolean;
  pubkey: string;
  path?: string;

  favicon: string;
  status: 'UP' | 'DOWN';
  softwareName: string;
  softwareVersion: string;
  label: string;
  name: string;

  constructor() {
    super(Peer.TYPENAME);
  }

  asObject(options?: EntityAsObjectOptions): any {
    return super.asObject(options);
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.dns = source.dns || source.host;
    this.ipv4 = source.ipv4;
    this.ipv6 = source.ipv6;
    this.port = isNotNil(source.port) ? +source.port : undefined;
    this.pubkey = source.pubkey;
    this.useSsl = source.useSsl || (this.port === 443);
    this.path = source.path || '';
  }

  equals(other: Peer): boolean {
    return super.equals(other) && this.pubkey === other.pubkey && this.url === other.url;
  }

  /**
   * Return the peer URL (without trailing slash)
   */
  get url(): string {
    return (this.useSsl ? 'https://' : 'http://') + this.hostAndPort + (this.path || '');
  }

  get hostAndPort(): string {
    return (this.dns || this.ipv4 || this.ipv6) +
      ((this.port && this.port !== 80 && this.port !== 443) ? ':' + this.port : '');
  }

  get reachable(): boolean {
    return this.status && this.status === 'UP';
  }
}
