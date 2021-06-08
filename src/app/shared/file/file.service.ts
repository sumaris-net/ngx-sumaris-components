import {Inject, Injectable} from '@angular/core';
import {Platform} from '@ionic/angular';
import * as uuidv4Imported from 'uuid/v4';
import {Base64ImageReader, Base64ImageResizeOptions} from './base64-image-reader';
import {chainPromises, firstNotNilPromise} from '../observables';
import {HttpClient} from '@angular/common/http';
import {ENVIRONMENT} from '../../../environments/environment.class';

const uuidv4 = uuidv4Imported;

@Injectable({
  providedIn: 'root',
  deps: [
    Platform,
    HttpClient
  ]
})
export class FileService {

  private readonly _debug: boolean;
  private _started = false;

  private _imageDirectory: string;

  get canUseFileSystem(): boolean {
    return false;
    // FIXME: seems not working well
    //return !!this.file.dataDirectory;
  }

  constructor(
    private platform: Platform,
    //private transfer: FileTransfer,
    //@Optional() private file: File,
    private http: HttpClient,
    @Inject(ENVIRONMENT) protected environment) {

    this._debug = !environment.production;

    platform.ready().then(() => this.start());
  }

  getImages(sources: string[], opts?: Base64ImageResizeOptions & {
    responseType?: 'file' | 'dataUrl';
  }): Promise<string[]> {
    if (!this._started) throw new Error('Platform must be started first!');

    //const fileTransfer = this.canUseFileSystem ? this.transfer.create() : undefined;
    //const jobsFactories = (sources || []).map(source => () => this.getImage(source, {...opts, fileTransfer}));

    const jobsFactories = (sources || []).map(source => () => this.getImage(source, {...opts}));
    return chainPromises<string>(jobsFactories);
  }

  async getImage(source: string, opts?: Base64ImageResizeOptions & {
    //fileTransfer?: FileTransferObject;
    responseType?: 'file' | 'dataUrl';
    }): Promise<string> {

    let responseType = opts && opts.responseType || (this.canUseFileSystem ? 'file' : 'dataUrl');

    const debug = this._debug /*&& (!opts || !opts.fileTransfer)*/;
    const now = debug && Date.now();
    if (debug) console.debug(`[file] Fetching image {${source}} into ${responseType}...`);

    // Read the filename
    const lastSlashIndex = source.lastIndexOf('/');
    if (lastSlashIndex === -1) throw new Error('Invalid URL: ' + source);
    const fileName = lastSlashIndex < (source.length - 1) && source.substring(lastSlashIndex + 1) || uuidv4();


    // Download into the file system
    if (responseType === 'file' && this.canUseFileSystem) {
      console.warn(`WARN: [file] Fetching image {${source}} in local file...`);
      const targetFilePath = this._imageDirectory + fileName;
      try {
        const blob: Blob = await firstNotNilPromise(this.http.get(source, {
          observe: 'body',
          responseType: 'blob',
          reportProgress: false
        }));
        console.debug('[file] Getting blob :' + blob.type);

        //await this.file.writeFile(this._imageDirectory, fileName, blob, {replace: true});

        //const fileTransfer = (opts && opts.fileTransfer) || this.transfer.create();
        //await fileTransfer.download(source, targetFilePath);
        if (debug) console.debug(`[file] Fetching image {${source}} into ${responseType} [OK] in ${Date.now() - now}ms`);
        return targetFilePath;
      }
      catch (err) {
        console.error(`[file] Error while download ${source}: ${err && err.message || err}`);

        // Continue (fallback to data Url)
        responseType = 'dataUrl';
      }
    }

    if (responseType === 'dataUrl') {
      // Get as data url (e.g. 'data:image/png:...')
      const dataUrl = await new Base64ImageReader().readAndResizeFromUrl(source, opts);
      if (debug) console.debug(`[file] Fetching image {${source}} into ${responseType} [OK] in ${Date.now() - now}ms`);
      return dataUrl;
    }

    // Keep original URL
    return source;
  }

  /* -- protected methods -- */

  protected start() {

    // File system exists
    if (this.canUseFileSystem) {
      //console.info("[file] Application directory: ", this.file.applicationDirectory);
      //console.info("[file] Application storage directory: ", this.file.applicationStorageDirectory);
      //console.info("[file] Data directory: ", this.file.dataDirectory);

      // this.file.createDir(this.file.dataDirectory, 'images', false)
      //   .then((dir) => {
      //     this._imageDirectory = this.file.dataDirectory + 'images/';
      //     console.info("[file] Images directory: ", dir.fullPath);
      //   })
      //   .catch(err => {
      //     console.error("[file] Cannot create the images directory: " + (this.file.dataDirectory + 'images/ : ' + (err && err.message || err)));
      //     this._imageDirectory = this.file.dataDirectory;
      //   });
    }

    this._started = true;
  }

}
