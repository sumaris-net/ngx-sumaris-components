import {Observable} from 'rxjs';
import {FetchPolicy, WatchQueryFetchPolicy} from '@apollo/client/core';
import {SortDirection} from '@angular/material/sort';
import {Directive, OnDestroy} from '@angular/core';
import {EmptyObject} from 'apollo-angular/types';

export declare interface Page {
  offset: number;
  size: number;
  sortBy?: string;
  sortDirection?: SortDirection;
}

export declare type FetchMoreFn<R, V = EmptyObject> = (variables?: V) => Promise<R>;

export declare interface LoadResult<T> {
  data: T[];
  total?: number;
  errors?: any[];
  fetchMore?: FetchMoreFn<LoadResult<T>>;
}

export declare type SuggestFn<T, F> = (value: any, filter?: F, sortBy?: string, sortDirection?: SortDirection) => Promise<T[] | LoadResult<T>>;

export declare interface SuggestService<T, F> {
  suggest: SuggestFn<T, F>;
}

export declare type FilterFn<T> = (data: T) => boolean;
export declare type FilterFnFactory<T, F> = (filter: F) => FilterFn<T>;

export declare interface EntityServiceLoadOptions {
  fetchPolicy?: FetchPolicy;
  trash?: boolean;
  toEntity?: boolean;
  [key: string]: any;
}

export declare interface IEntityService<
  T,
  ID = any,
  LO = EntityServiceLoadOptions> {

  load(
    id: ID,
    opts?: LO
  ): Promise<T>;

  save(data: T, opts?: any): Promise<T>;

  delete(data: T, opts?: any): Promise<any>;

  listenChanges(id: ID, opts?: any): Observable<T | undefined>;
}

export declare interface EntitiesServiceWatchOptions {
  fetchPolicy?: WatchQueryFetchPolicy;
  trash?: boolean;
  withTotal?: boolean;
  toEntity?: boolean;
  [key: string]: any;
}

export declare interface IEntitiesService<T, F, O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions> {

  watchAll(
    offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filter?: Partial<F>,
    options?: O
  ): Observable<LoadResult<T>>;

  // TODO
  /*watchPage(
    page: Page<T>,
    filter?: F,
    options?: O
  ): Observable<LoadResult<T>>;*/

  saveAll(data: T[], opts?: any): Promise<T[]>;

  deleteAll(data: T[], opts?: any): Promise<any>;

  asFilter(filter: Partial<F>): F;
}

export declare type LoadResultByPageFn<T> = (offset: number, size: number) => Promise<LoadResult<T>>;


export interface IEntityFullService<T, ID, F, O extends EntitiesServiceWatchOptions & EntityServiceLoadOptions>
  extends IEntityService<T, ID, O>, IEntitiesService<T, F, O>  {
}

@Directive()
export abstract class EntitiesService<T, F, O extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions>
  implements IEntitiesService<T, F, O>, OnDestroy {

  ngOnDestroy() {
    // Can be override by subclasses
  }

  abstract watchAll(
    offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: SortDirection,
    filter?: Partial<F>,
    options?: O
  ): Observable<LoadResult<T>>;

  // TODO
  /*watchPage(
    page: Page<T>,
    filter?: F,
    options?: O
  ): Observable<LoadResult<T>>;*/

  abstract saveAll(data: T[], options?: any): Promise<T[]>;

  abstract deleteAll(data: T[], options?: any): Promise<any>;

  abstract asFilter(filter: Partial<F>): F;
}
