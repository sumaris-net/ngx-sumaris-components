import {Injectable, Injector} from "@angular/core";
import {ReferentialRefService} from "../../referential/services/referential-ref.service";
import {environment} from "../../../environments/environment";
import {Observable, BehaviorSubject} from "rxjs";
import {isNil, isNotNil} from "../../shared/functions";
import {ReferentialFilter} from "../../referential/services/referential.service";
import {FetchPolicy} from "apollo-client";
import {LoadResult} from "../../shared/services/data-service.class";


export interface ProgressionModel {
  message: string;
  value: number;
  step: number;
  maxProgression: number;

  increment(opts?: {step?: number; message?: string; }): ProgressionModel;
}

export class ProgressionModelImpl implements ProgressionModel {

  private _$changes: BehaviorSubject<ProgressionModel>;
  private _message = '';

  value = 0;
  step = 1;
  maxProgression: number;

  constructor(opts?: Partial<ProgressionModel>) {
    if (opts) Object.assign(this, opts);
    if (isNil(this.maxProgression)) {
      this.maxProgression = 100;
    }
  }

  increment(opts?: {step?: number; message?: string; }): ProgressionModel {
    this.value += opts && isNotNil(opts.step) ? opts.step : this.step;
    if (this.value > this.maxProgression) {
      this.value = this.maxProgression;
    }
    if (opts && isNotNil(opts.message)) {
      this._message = opts.message;
    }
    if (this._$changes) this._$changes.next(this);

    return this;
  }

  get message(): string {
    return this._message;
  }

  set message(message: string) {
    this._message = message;
    if (this._$changes) this._$changes.next(this);
  }

  asObservable(): Observable<ProgressionModel> {
    if (!this._$changes) {
      this._$changes = new BehaviorSubject(this);
    }
    return this._$changes;
  }
}

@Injectable({providedIn: 'root'})
export class SynchroService {

  protected _debug = false;
  protected loading = false;

  constructor(protected referentialRefService: ReferentialRefService) {

    // FOR DEV ONLY
    this._debug = !environment.production;
  }

  executeImport(opts?: Partial<ProgressionModel>): Observable<ProgressionModel> {


    //return this.referentialRefService.importAll({maxProgression});

    const progression = new ProgressionModelImpl(opts);
    const stepCount = 1;
    progression.step = (progression.maxProgression - (opts && opts.value || 0)) / stepCount;

    Promise.all([
      this.importAllVessels(progression)
    ])
      .then(() => {
        console.info("[synchro] Finished in XXms");
      });


    return progression.asObservable();
  }

  /* protected methods */

  protected async importAllVessels(progression: ProgressionModel) {
    progression.message = "Importing vessels";

    progression.increment();

  }
}
