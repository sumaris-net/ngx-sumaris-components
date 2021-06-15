import {BehaviorSubject, Observable} from 'rxjs';
import {filter, map, mergeMap} from 'rxjs/operators';
import {isEmptyArray, isNotEmptyArray, isNotNil} from '../functions';
import {EntitiesService, EntitiesServiceWatchOptions, FilterFn, FilterFnFactory, IEntitiesService, LoadResult} from './entity-service.class';
import {SortDirection} from '@angular/material/sort';
import {Directive, OnDestroy} from '@angular/core';
import {EntityUtils, IEntity} from '../../core/services/model/entity.model';
import {EntityFilter, EntityFilterUtils} from '../../core/services/model/filter.model';

export interface InMemoryEntitiesServiceOptions<T, F> {
  onSort?: (data: T[], sortBy?: string, sortDirection?: SortDirection) => T[];
  onLoad?: (data: T[]) => T[] | Promise<T[]>;
  onSave?: (data: T[]) => T[] | Promise<T[]>;
  equals?: (d1: T, d2: T) => boolean;

  filterFnFactory?: FilterFnFactory<T, F>;
  filterFn?: FilterFn<T>;

  sortByReplacement?: { [key: string]: string };
}

// @dynamic
@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class InMemoryEntitiesService<
  T extends IEntity<T, ID>,
  F = any,
  ID = number,
  O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions>
  extends EntitiesService<T, F, ID>
  implements IEntitiesService<T, F, O>, OnDestroy {

  debug = false;
  dirty = false;

  protected data: T[];
  private _hiddenData: T[];

  private readonly _onChange = new BehaviorSubject(true);
  private readonly _sortFn: (data: T[], sortBy?: string, sortDirection?: SortDirection) => T[];
  private readonly _onLoad: (data: T[]) => T[] | Promise<T[]>;
  private readonly _onSaveFn: (data: T[]) => T[] | Promise<T[]>;
  private readonly _equalsFn: (d1: T, d2: T) => boolean;
  private readonly _filterFnFactory: FilterFnFactory<T, F>;
  private readonly _sortByReplacement: { [key: string]: string };

  // TODO add test  see sub-batches.modal.ts onLoadData & _hiddenData

  set value(data: T[]) {
    this.setValue(data);
  }

  get value(): T[] {
    return this.data;
  }

  constructor(
    protected dataType: new() => T,
    protected filterType: new() => F,
    options?: InMemoryEntitiesServiceOptions<T, F>
  ) {
    super();
    options = {
      onSort: this.sort,
      equals: this.equals,
      ...options
    };

    this._sortFn = options.onSort;
    this._onLoad = options.onLoad;
    this._onSaveFn = options.onSave;
    this._equalsFn = options.equals;
    this._filterFnFactory = options.filterFnFactory || ((f) => {
      const filter = this.asFilter(f) as F;
      if (filter instanceof EntityFilter) {
        return filter.asFilterFn();
      }
      return undefined;
    });

    this._sortByReplacement = {
      // Detect rankOrder on the entity class
      id: (Object.getOwnPropertyNames(new dataType()).findIndex(key => key === 'rankOrder') !== -1) ? 'rankOrder' : undefined,
      ...options.sortByReplacement
    };
  }

  ngOnDestroy() {
    if (this.debug) console.debug('[memory-data-service] Destroying...');
    this._onChange.complete();
    this._onChange.unsubscribe();
  }

  setValue(data: T[], opts?: { emitEvent?: boolean }) {
    if (this.data !== data) {
      this._hiddenData = [];
      this.data = data;

      // Send to observers
      if (!opts || opts.emitEvent !== false) {
        this._onChange.next(true);
      }
    }
    this.dirty = false;
  }

  watchAll(
    offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filterData?: F,
    options?: any
  ): Observable<LoadResult<T>> {

    offset = offset >= 0 ? offset : 0;
    size = size >= 0 ? size : -1;

    if (!this.data) {
      console.warn('[memory-data-service] Waiting value to be set...');
    }

    return this._onChange
      .pipe(
        filter(isNotNil),
        mergeMap(async (_) => {
          this._hiddenData = [];

          if (isEmptyArray(this.data)) {
            return {data: [], total: 0};
          }

          // Apply sort
          let data = this._sortFn(this.data || [], sortBy, sortDirection) ;

          if (this._onLoad) {
            const promiseOrData = this._onLoad(data);
            data = ((promiseOrData instanceof Promise)) ? await promiseOrData : promiseOrData;
          }


          // Apply filter (will update hiddenData)
          data = this.filter(data, filterData, this._hiddenData);

          // Compute the total length
          const total = data.length;

          // If page size=0 (e.g. only need total)
          if (size === 0) {
            this._hiddenData.push(...data);
            return {data: [], total};
          }

          // Slice in a page (using offset and size)
          if (offset > 0) {

            // Offset after the end: no result
            if (offset >= data.length) {
              this._hiddenData.push(...data);
              data = [];
            }
            else {
              const hiddenData = (size > 0 && ((offset + size) < data.length)) ?
                // Slice using limit to size
                data.slice(0, offset -1).concat(data.slice(offset + size)) :
                // Slice without limit
                data.slice(0, offset-1);
              this._hiddenData.push(...hiddenData);
              data = (size > 0 && ((offset + size) < data.length)) ?
                // Slice using limit to size
                data.slice(offset, offset + size) :
                // Slice without limit
                data.slice(offset);
            }
          }

          // Apply a limit
          else if (size > 0){
            this._hiddenData.push(...data.slice(size));
            data = data.slice(0, size);
          }
          // No limit:
          else if (size === -1){
            // Keep all data
          }

          // /!\ If already observed, then always create a copy of the original array
          // Because datasource will only update if the array changed
          if (data === this.data) {
            data = data.slice(0);
          }

          return {data, total};
        })
      );
  }

  async saveAll(data: T[], options?: any): Promise<T[]> {
    if (!this.data) throw new Error('[memory-service] Could not save, because value not set');

    // Restore hidden data
    if (isNotEmptyArray(this._hiddenData))
      data = data.concat(this._hiddenData);

    if (this._onSaveFn) {
      const res = this._onSaveFn(data);
      data = ((res instanceof Promise)) ? await res : res;
    }

    this.data = data;
    this.dirty = true;
    return this.data;
  }

  async deleteAll(dataToRemove: T[], options?: any): Promise<any> {
    if (!this.data) throw new Error('[memory-service] Could not delete, because value not set');

    // Remove deleted item, from data
    const updatedData = this.data.filter(entity => {
      const shouldRemoved = dataToRemove.findIndex(entityToRemove => this._equalsFn(entityToRemove, entity)) !== -1;
      return !shouldRemoved;
    });
    const deleteCount = this.data.length - updatedData.length;
    if (deleteCount > 0) {
      this.data = updatedData;
      this.dirty = true;
      this._onChange.next(true);
    }

  }

  sort(data: T[], sortBy?: string, sortDirection?: SortDirection): T[] {
    // Replace sortBy, using the replacement map
    sortBy = sortBy && this._sortByReplacement[sortBy] || sortBy || 'id';

    // Execute the sort
    return EntityUtils.sort(data, sortBy, sortDirection);
  }

  asFilter(source: Partial<F>): F {
    return EntityFilterUtils.fromObject(source, this.filterType);
  }

  protected filter(data: T[], _filter: F, hiddenData: T[]): T[] {

    // if filter is DataFilter instance, use its test function
    const filterFn = this._filterFnFactory && this._filterFnFactory(_filter);
    if (filterFn) {
      const filteredData = [];

      data.forEach(value => {
        if (filterFn(value))
          filteredData.push(value);
        else
          hiddenData.push(value);
      });

      return filteredData;
    }

    // default, no filter
    return data;
  }

  protected connect(): Observable<LoadResult<T>> {
    return this._onChange.pipe(
      map(_ => {
        const data = this.data || [];
        const total = data.length;
        return {data, total};
      })
    );
  }

  protected equals(d1: T, d2: T): boolean {
    return d1 && d1.equals ? d1.equals(d2) : EntityUtils.equals(d1, d2, 'id');
  }
}

