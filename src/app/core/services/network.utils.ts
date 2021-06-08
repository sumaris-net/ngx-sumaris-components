import {HttpClient, HttpHeaders} from '@angular/common/http';
import {HttpUtils} from '../../shared/http/http.utils';
import {Peer} from './model/peer.model';

export interface NodeInfo {
  softwareName: string;
  softwareVersion: string;
  nodeLabel?: string;
  nodeName?: string;
}

export class NetworkUtils {
  static getNodeInfo = getNodeInfo;
}

export async function getNodeInfo(
  http: HttpClient,
  peer: string|Peer,
  opts?: {
  headers?: HttpHeaders | {
    [header: string]: string | string[];
  };
}): Promise<NodeInfo> {

  if (!peer) throw Error('Missing argument \'peer\'.');

  let peerUrl = (peer instanceof Peer) ? peer.url : (peer as string);
  // Remove trailing slash
  if (peerUrl.endsWith('/')) {
    peerUrl = peerUrl.substr(0, peerUrl.length -1);
  }

  return HttpUtils.getResource(http, peerUrl + '/api/node/info', opts);
}
