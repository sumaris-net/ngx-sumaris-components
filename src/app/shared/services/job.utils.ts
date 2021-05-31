import {BehaviorSubject, defer, Observable, Subject} from "rxjs";
import {isNil, isNotNil} from "../functions";
import {LoadResult, LoadResultByPageFn} from "./entity-service.class";

export type CallableWithProgressionFn<O extends CallableWithProgressionOptions> = (progression: BehaviorSubject<number>, opts?: O) => Promise<void>;
export interface CallableWithProgressionOptions {
  maxProgression?: number;
  [key: string]: any;
}

// @dynamic
export class JobUtils {

  static defers<O extends CallableWithProgressionOptions>(runnableList: CallableWithProgressionFn<O>[], opts?: O): Observable<number>[] {
    return runnableList.map(runnable => JobUtils.defer(runnable, opts));
  }

  static defer<O extends CallableWithProgressionOptions>(runnable: CallableWithProgressionFn<O>, opts?: O): Observable<number> {
    return defer<Observable<number>>(() => JobUtils.run(runnable, opts));
  }

  static run<O extends CallableWithProgressionOptions>(runnable: CallableWithProgressionFn<O>, opts: O): Observable<number> {

    const progression = new BehaviorSubject<number>(0);
    runnable(progression, opts)
      .then(() => {
        if (opts && opts.maxProgression) progression.next(opts.maxProgression);
        progression.complete();
      })
      .catch(err => progression.error(err));
    return progression;
  }

  static async fetchAllPages<T>(
    loadPageFn: LoadResultByPageFn<T>,
    progression: BehaviorSubject<number>,
    opts?: {
      maxProgression?: number,
      onPageLoaded?: (pageResult: LoadResult<T>) => any;
      logPrefix?: string;
      fetchSize?: number;
    }): Promise<LoadResult<T>> {

    const maxProgression = opts && opts.maxProgression || undefined;
    let total, loopCount, progressionStep, loopDataCount: number;
    const fetchSize = opts && opts.fetchSize || 1000;
    let offset = 0;
    let data: T[] = [];
    do {

      if (opts && opts.logPrefix) console.debug(`${opts.logPrefix} Fetching page #${offset / fetchSize}...`);

      // Get some items, using paging
      const res = await loadPageFn(offset, fetchSize);
      data = data.concat(res.data);
      loopDataCount = res.data && res.data.length || 0;
      offset += loopDataCount;

      // Set total count (only if not already set)
      if (isNil(total) && isNotNil(res.total)) {
        total = res.total;
        loopCount = Math.round(res.total / fetchSize + 0.5); // Round to next integer
        progressionStep = maxProgression ? maxProgression / loopCount : undefined /*if 0 reset to undefined*/;
      }

      // Increment progression on each iteration (if possible)
      if (isNotNil(progressionStep)) {
        progression.next(progression.getValue() + progressionStep);
      }

      if (opts && opts.onPageLoaded) opts.onPageLoaded(res);

    } while (loopDataCount > 0 && ((isNil(total) && loopDataCount === fetchSize) || (isNotNil(total) && (offset < total))));

    // Complete progression to reach progressionStep value (because of round)
    if (isNotNil(progressionStep)) {

      // If total return by loadAll was bad !
      if (isNotNil(total) && data.length < total) {
        console.warn(`A function loadAll() returned a bad total (less than all page's data)! Expected ${total} but fetch ${data.length}`);
        total = data.length;
        loopCount = Math.round(data.length / fetchSize + 0.5);
      }

      const lastProgressionStep = opts.maxProgression - (progressionStep * loopCount);
      if (lastProgressionStep > 0) {
        progression.next(progression.getValue() + lastProgressionStep);
      }
    }
    // Or increment once
    else if (opts.maxProgression) {
      progression.next(progression.getValue() + opts.maxProgression);
    }

    return {
      data,
      total
    };
  }
}
