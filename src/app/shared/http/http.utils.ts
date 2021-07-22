import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';

export class HttpUtils {
  static async getResource<T>(http: HttpClient,
                              uri: string,
                              opts?: {
                                headers?: HttpHeaders | {
                                  [header: string]: string | string[];
                                };
                                params?: HttpParams | {
                                  [param: string]: string | string[];
                                };
                                reportProgress?: boolean;
                                responseType?: 'json';
                                withCredentials?: boolean;
                              }): Promise<T> {

    // Add headers
    opts = {
      //headers: new HttpHeaders(),
      //.append('X-App-Name', environment.name)
      //.append('X-App-Version', environment.version),
      ...opts
    };

    try {
      // Using web http client
      return (await http.get(uri, opts).toPromise()) as T;
    }
    catch (err) {
      if (err && err.message) {
        console.error(`[network] Error on get request ${uri}: ${err.message}`, err);
      }
      else {
        console.error(`[network] Error on get request ${uri}: ${err && err.statusText} - ${JSON.stringify(err)}`);
      }
      throw {code: err.status, message: 'ERROR.UNKNOWN_NETWORK_ERROR'};
    }
  }
}



