import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ErrorCodes} from './errors';

import {FetchPolicy, MutationUpdaterFn} from '@apollo/client/core';
import {SortDirection} from '@angular/material/sort';

import {BaseGraphqlService} from './base-graphql-service.class';
import {EntitiesServiceWatchOptions, EntityServiceLoadOptions, IEntitiesService, IEntityService, LoadResult} from '../../shared/services/entity-service.class';
import {GraphqlService} from '../graphql/graphql.service';
import {PlatformService} from './platform.service';
import {environment} from '../../../environments/environment';
import {Entity, EntityAsObjectOptions, EntityUtils} from './model/entity.model';
import {chainPromises} from '../../shared/observables';
import {isEmptyArray, isNil, isNotNil, removeEnd, toBoolean} from '../../shared/functions';
import {Directive} from '@angular/core';
import {RefetchQueryDescription} from '@apollo/client/core/watchQueryOptions';
import {FetchResult} from '@apollo/client/link/core';
import {EntityFilter, EntityFilterUtils} from './model/filter.model';
import {DocumentNode} from 'graphql';

export type MutableWatchQueriesUpdatePolicy = 'update-cache' | 'refetch-queries';

export interface BaseEntityGraphqlQueries {
  load?: any;
  loadAll: any;
  loadAllWithTotal?: any;
}
export interface BaseEntityGraphqlMutations {
  save?: any;
  delete?: any;
  saveAll?: any;
  deleteAll?: any;
}

export interface BaseEntityGraphqlSubscriptions {
  listenChanges?: any;
}
export interface BaseEntityServiceOptions<
  T extends Entity<any, ID>,
  ID = number,
  Q extends BaseEntityGraphqlQueries = BaseEntityGraphqlQueries,
  M extends BaseEntityGraphqlMutations = BaseEntityGraphqlMutations,
  S extends BaseEntityGraphqlSubscriptions = BaseEntityGraphqlSubscriptions> {
  queries: Q;
  mutations?: Partial<M>;
  subscriptions?: Partial<S>;
  equalsFn?: (e1: T, e2: T) => boolean;
  isNewFn?: (e: T) => boolean;
  defaultSortBy?: keyof T;
  defaultSortDirection?: SortDirection;
  watchQueriesUpdatePolicy?: MutableWatchQueriesUpdatePolicy;
}

export interface EntitySaveOptions {
  refetchQueries?: ((result: FetchResult<{data: any}>) => RefetchQueryDescription) | RefetchQueryDescription;
  awaitRefetchQueries?: boolean;
  update?: MutationUpdaterFn<{ data: any; }>;
}


// @dynamic
@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class BaseEntityService<
  T extends Entity<T, ID>,
  F extends EntityFilter<F, T, ID>,
  ID = number,
  WO extends EntitiesServiceWatchOptions = EntitiesServiceWatchOptions,
  LO extends EntityServiceLoadOptions = EntityServiceLoadOptions,
  Q extends BaseEntityGraphqlQueries = BaseEntityGraphqlQueries,
  M extends BaseEntityGraphqlMutations = BaseEntityGraphqlMutations,
  S extends BaseEntityGraphqlSubscriptions = BaseEntityGraphqlSubscriptions>
  extends BaseGraphqlService<T, F, ID>
  implements
    IEntitiesService<T, F, WO>,
    IEntityService<T, ID, LO> {

  protected readonly _typename: string;
  protected readonly _logTypeName: string;

  protected readonly queries: Q;
  protected readonly mutations: Partial<M>;
  protected readonly subscriptions: Partial<S>;
  protected readonly equalsFn: (e1: T, e2: T) => boolean;
  protected readonly isNewFn: (e: T) => boolean;

  protected readonly defaultSortBy: keyof T;
  protected readonly defaultSortDirection: SortDirection;
  protected readonly watchQueriesUpdatePolicy: MutableWatchQueriesUpdatePolicy;

  protected constructor(
    protected graphql: GraphqlService,
    protected platform: PlatformService,
    protected dataType: new() => T,
    protected filterType: new() => F,
    options: BaseEntityServiceOptions<T, ID, Q, M, S>
  ) {
    super(graphql, environment);
    this.queries = options.queries;
    this.mutations = options.mutations || <Partial<M>>{};
    this.subscriptions = options.subscriptions || <Partial<S>>{};
    this.equalsFn = options.equalsFn || ((e1, e2) => EntityUtils.equals(e1, e2, 'id'));
    this.isNewFn = options.isNewFn || ((e) => EntityUtils.isNotEmpty(e, 'id'));
    this.defaultSortBy = options.defaultSortBy || 'id';
    this.defaultSortDirection = options.defaultSortDirection || 'asc';
    this.watchQueriesUpdatePolicy = options.watchQueriesUpdatePolicy || 'update-cache';

    platform.ready().then(() => {
      // No limit for updatable watch queries, if desktop
      if (!platform.mobile) {
        this._mutableWatchQueriesMaxCount = -1;
      }
    });

    const obj = new dataType();
    this._typename = obj.__typename || 'UnknownVO';
    this._logTypeName = removeEnd(this._typename, 'VO');

    // For DEV only
    this._debug = !environment.production;
  }

  watch(id: number, opts?: WO & { query?: any }): Observable<T> {

    if (this._debug) console.debug(this._logPrefix + `Watching ${this._logTypeName} {${id}}...`);

    const query = opts && opts.query || this.queries.load;
    return this.graphql.watchQuery<{data: any}>({
      query,
      variables: { id },
      fetchPolicy: opts && (opts.fetchPolicy as FetchPolicy) || undefined,
      error: {code: ErrorCodes.LOAD_DATA_ERROR, message: 'REFERENTIAL.ERROR.LOAD_DATA_ERROR'}
    })
      .pipe(
        map(({data}) => (!opts || opts.toEntity !== false)
            ? (data && this.fromObject(data))
            : (data as T))
      );
  }

  async load(id: ID, opts?: LO & { query?: any }): Promise<T> {

    if (this._debug) console.debug(this._logPrefix + `Loading ${this._logTypeName} {${id}}...`);
    const query = opts && opts.query || this.queries.load;

    const { data } = await this.graphql.query<{data: any}>({
      query,
      variables: { id },
      fetchPolicy: opts && (opts.fetchPolicy as FetchPolicy) || undefined,
      error: {code: ErrorCodes.LOAD_DATA_ERROR, message: 'REFERENTIAL.ERROR.LOAD_DATA_ERROR'}
    });

    // Convert to entity
    return (!opts || opts.toEntity !== false)
      ? (data && this.fromObject(data))
      : (data as T);
  }

  watchAll(offset: number,
           size: number,
           sortBy?: string,
           sortDirection?: SortDirection,
           filter?: F,
           opts?: WO & { query?: any }
  ): Observable<LoadResult<T>> {

    filter = this.asFilter(filter);

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || this.defaultSortBy,
      sortDirection: sortDirection || this.defaultSortDirection,
      filter: filter && filter.asPodObject()
    };

    let now = this._debug && Date.now();
    if (this._debug) console.debug(this._logPrefix + `Watching ${this._logTypeName}...`, variables);

    const withTotal = (!opts || opts.withTotal !== false) && this.queries.loadAllWithTotal && true;
    const query = (opts && opts.query) // use given query
      // Or get loadAll or loadAllWithTotal query
      || withTotal ? this.queries.loadAllWithTotal  : this.queries.loadAll;
    return this.mutableWatchQuery<LoadResult<any>>({
      queryName: withTotal ? 'LoadAllWithTotal' : 'LoadAll',
      query,
      arrayFieldName: 'data',
      totalFieldName: withTotal ? 'total' : undefined,
      insertFilterFn: filter && filter.asFilterFn(),
      variables,
      error: {code: ErrorCodes.LOAD_DATA_ERROR, message: 'REFERENTIAL.ERROR.LOAD_DATA_ERROR'},
      fetchPolicy: opts && opts.fetchPolicy || 'network-only'
    })
      .pipe(
        map(({data, total}) => {
          // Convert to entity (if need)
          const entities = (!opts || opts.toEntity !== false)
            ? (data || []).map(json => this.fromObject(json))
            : (data || []) as T[];

          if (now) {
            console.debug(this._logPrefix + `${this._logTypeName} loaded in ${Date.now() - now}ms`, entities);
            now = null;
          }
          return {data: entities, total};
        })
      );
  }

  async loadAll(offset: number,
                size: number,
                sortBy?: string,
                sortDirection?: SortDirection,
                filter?: Partial<F>,
                opts?: LO & {
                  query?: any;
                  debug?: boolean;
                  withTotal?: boolean;
                }
  ): Promise<LoadResult<T>> {

    const debug = this._debug && (!opts || opts.debug !== false);

    filter = this.asFilter(filter);

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'id',
      sortDirection: sortDirection || 'asc',
      filter: filter && filter.asPodObject()
    };

    const now = Date.now();
    if (debug) console.debug(this._logPrefix + `Loading ${this._logTypeName}...`, variables);

    const withTotal = (!opts || opts.withTotal !== false) && this.queries.loadAllWithTotal && true;
    const query = (opts && opts.query) // use given query
      // Or get loadAll or loadAllWithTotal query
      || withTotal ? this.queries.loadAllWithTotal  : this.queries.loadAll;
    const {data, total} = await this.graphql.query<LoadResult<any>>({
      query,
      variables,
      error: {code: ErrorCodes.LOAD_DATA_ERROR, message: 'ERROR.LOAD_DATA_ERROR'},
      fetchPolicy: opts && opts.fetchPolicy || 'network-only'
    });
    const entities = (!opts || opts.toEntity !== false) ?
      (data || []).map(json => this.fromObject(json)) :
      (data || []) as T[];
    if (debug) console.debug(this._logPrefix + `${this._logTypeName} items loaded in ${Date.now() - now}ms`);
    return {
      data: entities,
      total
    };
  }


  async saveAll(entities: T[], opts?: EntitySaveOptions): Promise<T[]> {
    if (isEmptyArray(entities)) return entities; // Nothing to save: skip

    if (!this.mutations.saveAll) {
      if (!this.mutations.save) throw new Error('Not implemented');
      // Save one by one
      return chainPromises((entities || [])
        .map(entity => (() => this.save(entity, opts))));
    }

    let hasNewEntities = false;
    const json = entities.map(entity => {
      hasNewEntities = hasNewEntities || this.isNewFn(entity);
      this.fillDefaultProperties(entity);
      return this.asObject(entity);
    });

    const now = Date.now();
    if (this._debug) console.debug(this._logPrefix + `Saving all ${this._logTypeName}...`, json);

    await this.graphql.mutate<LoadResult<any>>({
      mutation: this.mutations.saveAll,
      refetchQueries: this.getRefetchQueriesForMutation(opts),
      awaitRefetchQueries: toBoolean(opts && opts.awaitRefetchQueries, false),
      variables: {
        data: json
      },
      error: {code: ErrorCodes.SAVE_DATA_ERROR, message: 'ERROR.SAVE_DATA_ERROR'},
      update: (proxy, {data}) => {
        const savedEntities = data && data.data;
        if (savedEntities) {
          // Update entities (id and update date)
          entities.forEach(entity => {
            const savedEntity = savedEntities.find(e => this.equalsFn(e, entity));
            this.copyIdAndUpdateDate(savedEntity, entity);
          });

          if (hasNewEntities && this.watchQueriesUpdatePolicy === 'update-cache') {
            // Update the cache
            this.insertIntoMutableCachedQueries(proxy, {
              queries: this.getLoadQueries(),
              data: savedEntities
            });
          }
        }

        if (opts && opts.update) {
          opts.update(proxy, {data});
        }

        if (this._debug) console.debug(`${this._logTypeName} saved in ${Date.now() - now}ms`, entities);

      }
    });

    return entities;
  }

  /**
   * Save a referential entity
   *
   * @param entity
   * @param opts
   */
  async save(entity: T, opts?: EntitySaveOptions): Promise<T> {
    if (!this.mutations.save) {
      if (!this.mutations.saveAll) throw new Error('Not implemented');
      const data = await this.saveAll([entity], opts);
      return data && data[0];
    }

    // Fill default properties
    this.fillDefaultProperties(entity);

    // Transform into json
    const json = this.asObject(entity);

    const isNew = this.isNewFn(json);

    const now = Date.now();
    if (this._debug) console.debug(this._logPrefix + `Saving ${this._logTypeName}...`, json);

    await this.graphql.mutate<{data: any}>({
      mutation: this.mutations.save,
      refetchQueries: this.getRefetchQueriesForMutation(opts),
      awaitRefetchQueries: toBoolean(opts && opts.awaitRefetchQueries, false),
      variables: {
        data: json
      },
      error: {code: ErrorCodes.SAVE_DATA_ERROR, message: 'ERROR.SAVE_DATA_ERROR'},
      update: (proxy, {data}) => {
        // Update entity
        const savedEntity = data && data.data;
        this.copyIdAndUpdateDate(savedEntity, entity);

        if (this._debug) console.debug(this._logPrefix + `${entity.__typename} saved in ${Date.now() - now}ms`, entity);

        // Insert into the cache
        if (isNew && this.watchQueriesUpdatePolicy === 'update-cache') {
          this.insertIntoMutableCachedQueries(proxy, {
            queries: this.getLoadQueries(),
            data: savedEntity
          });
        }

        if (opts && opts.update) {
          opts.update(proxy, {data});
        }
      }
    });

    return entity;
  }

  /**
   * Delete referential entities
   */
  async deleteAll(entities: T[], opts?: Partial<{
    update: MutationUpdaterFn<any>;
  }> | any): Promise<any> {
    if (!this.mutations.deleteAll) {
      if (!this.mutations.delete) throw new Error('Not implemented');
      // Delete one by one
      return chainPromises((entities || [])
        .map(entity => (() => this.delete(entity, opts))));
    }

    // Filter saved entities
    entities = entities && entities.filter(e => isNotNil(e.id));

    // Nothing to save: skip
    if (isEmptyArray(entities)) return;

    const ids = entities.map(t => t.id);
    const now = new Date();
    if (this._debug) console.debug(this._logPrefix + `Deleting ${this._logTypeName}...`, ids);

    await this.graphql.mutate<any>({
      mutation: this.mutations.deleteAll,
      refetchQueries: this.getRefetchQueriesForMutation(opts),
      awaitRefetchQueries: toBoolean(opts && opts.awaitRefetchQueries, false),
      variables: { ids },
      error: {code: ErrorCodes.DELETE_DATA_ERROR, message: 'ERROR.DELETE_DATA_ERROR'},
      update: (proxy, res) => {

        // Remove from cache
        if (this.watchQueriesUpdatePolicy === 'update-cache') {
          this.removeFromMutableCachedQueriesByIds(proxy, {
            queries: this.getLoadQueries(),
            ids
          });
        }

        if (opts && opts.update) {
          opts.update(proxy, res);
        }

        if (this._debug) console.debug(this._logPrefix + `${this._logTypeName} deleted in ${new Date().getTime() - now.getTime()}ms`);
      }
    });
  }

  /**
   * Delete a referential entity
   */
  async delete(entity: T, opts?: EntitySaveOptions | any): Promise<any> {
    if (!this.mutations.delete) {
      if (!this.mutations.deleteAll) throw new Error('Not implemented');
      const data = await this.deleteAll([entity], opts);
      return data && data[0];
    }

    // Nothing to save: skip
    if (!entity || isNil(entity.id)) return;

    const id = entity.id;
    const now = new Date();
    if (this._debug) console.debug(this._logPrefix + `Deleting ${this._logTypeName} {${id}}...`);

    await this.graphql.mutate<any>({
      mutation: this.mutations.delete,
      refetchQueries: this.getRefetchQueriesForMutation(opts),
      awaitRefetchQueries: toBoolean(opts && opts.awaitRefetchQueries, false),
      variables: { id },
      error: {code: ErrorCodes.DELETE_DATA_ERROR, message: 'ERROR.DELETE_DATA_ERROR'},
      update: (proxy, res) => {

        // Remove from cache
        if (this.watchQueriesUpdatePolicy === 'update-cache') {
          this.removeFromMutableCachedQueriesByIds(proxy, {
            queries: this.getLoadQueries(),
            ids: [id]
          });
        }

        if (opts && opts.update) {
          opts.update(proxy, res);
        }

        if (this._debug) console.debug(this._logPrefix + `${this._logTypeName} deleted in ${new Date().getTime() - now.getTime()}ms`);
      }
    });
  }

  listenChanges(id: ID, opts?: {
    query?: any;
    variables?: any;
    interval?: number;
    toEntity?: boolean;
  }): Observable<T> {
    if (isNil(id)) throw Error('Missing argument \'id\' ');
    if (!this.subscriptions.listenChanges) throw Error('Not implemented!');

    const variables = opts && opts.variables || {
      id,
      interval: opts && opts.interval || 10 // seconds
    };
    if (this._debug) console.debug(this._logPrefix + `[WS] Listening for changes on ${this._logTypeName} {${id}}...`);

    return this.graphql.subscribe<{data: any}>({
      query: opts && opts.query || this.subscriptions.listenChanges,
      variables,
      error: {
        code: ErrorCodes.SUBSCRIBE_DATA_ERROR,
        message: 'ERROR.SUBSCRIBE_DATA_ERROR'
      }
    })
      .pipe(
        map(({data}) => {
          const entity = (!opts || opts.toEntity !== false) ? data && this.fromObject(data) : data;
          if (entity && this._debug) console.debug(this._logPrefix + `[WS] Received changes on ${this._logTypeName} {${id}}`, entity);

          // TODO: missing = deleted ?
          if (!entity) console.warn(this._logPrefix + `[WS] Received deletion on ${this._logTypeName} {${id}} - TODO check implementation`);

          return entity;
        })
      );
  }

  copyIdAndUpdateDate(source: T, target: T) {
    if (!source) return;

    // Update (id and updateDate)
    EntityUtils.copyIdAndUpdateDate(source, target);
  }


  fromObject(source: any): T {
    if (!source) return source;
    const target = new this.dataType();
    target.fromObject(source);
    return target;
  }

  asFilter(source: any): F {
    return EntityFilterUtils.fromObject(source, this.filterType);
  }

  /* -- protected functions -- */

  protected fillDefaultProperties(source: T) {
    // Can be override by subclasses
  }

  protected asObject(entity: T, opts?: EntityAsObjectOptions): any {
    // Can be override by subclasses
    return entity.asObject(opts);
  }

  protected getRefetchQueriesForMutation(opts?: EntitySaveOptions): ((result: FetchResult<{data: any}>) => RefetchQueryDescription) | RefetchQueryDescription {
    if (opts && opts.refetchQueries) return opts.refetchQueries;

    // Skip if update policy not used refecth queries
    if (this.watchQueriesUpdatePolicy !== 'refetch-queries') return undefined;

    const queries = this.getLoadQueries();
    if (!queries.length) return undefined; // Skip if empty

    // Find the refetch queries definition
    return this.findRefetchQueries({queries});
  }

  protected getLoadQueries(): DocumentNode[] {
    return [this.queries.loadAll, this.queries.loadAllWithTotal].filter(isNotNil);
  }

}
