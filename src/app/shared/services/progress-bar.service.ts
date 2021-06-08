import {EventEmitter, Injectable} from '@angular/core';

export declare type ProgressMode = 'determinate' | 'indeterminate' | 'buffer' | 'query' | 'none';

@Injectable({providedIn: 'root'})
export class ProgressBarService {
  private _requestsRunning = 0;

  onProgressChanged = new EventEmitter<ProgressMode>();

  list(): number {
      return this._requestsRunning;
  }

  increase(): void {
    this._requestsRunning++;
    if (this._requestsRunning === 1) {
        this.onProgressChanged.emit('query');
    }
  }

  decrease(): void {
    if (this._requestsRunning > 0) {
        this._requestsRunning--;
    }
    if (this._requestsRunning === 0) {
      this.onProgressChanged.emit('none');
    }
  }
}
