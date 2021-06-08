import {GraphqlService, MutateQueryOptions, WatchQueryOptions} from '../graphql/graphql.service';
import {Page} from '../../shared/services/entity-service.class';
import {EmptyObject} from 'apollo-angular/types';
import {Observable} from 'rxjs';
import {FetchResult} from '@apollo/client/link/core';
import {EntityUtils} from './model/entity.model';
import {ApolloCache} from '@apollo/client/core';
import {changeCaseToUnderscore, isNotEmptyArray, toBoolean} from '../../shared/functions';
import {environment} from '../../../environments/environment';
import {Directive, Optional} from '@angular/core';
import {QueryRef} from 'apollo-angular';
import {PureQueryOptions} from '@apollo/client/core/types';
import {DocumentNode} from 'graphql';

const sha256 =  require('hash.js/lib/hash/sha/256');

export interface QueryVariables<F= any> extends Partial<Page> {
  filter?: F;
  [key: string]: any;
}

export interface MutateQueryWithCacheUpdateOptions<T = any, V = EmptyObject> extends MutateQueryOptions<T, V> {
  cacheInsert?: {
    query: any;
    fetchData: (variables: V, mutationResult: FetchResult<T>) => any;
  }[];

  cacheRemove?: {
    query: any;
    fetchIds: (variables: V) => number | number[];
  }[];
}

export interface MutableWatchQueryOptions<D, T = any, V = EmptyObject> extends WatchQueryOptions<V> {
  queryName: string;
  arrayFieldName: keyof D;
  totalFieldName?: keyof D ;
  insertFilterFn?: (data: T) => boolean;
  sortFn?: (a: T, b: T) => number;
}

export interface MutableWatchQueryDescription<D, T = any, V = EmptyObject> extends PureQueryOptions {
  id?: string;
  query: DocumentNode;
  queryRef: QueryRef<D, V>;
  variables: V;
  arrayFieldName: keyof D;
  totalFieldName?: keyof D;
  insertFilterFn?: (data: T) => boolean;
  sortFn?: (a: T, b: T) => number;
  counter: number;
}

export interface FindMutableWatchQueriesOptions {
  query?: DocumentNode;
  queries?: DocumentNode[];
  queryName?: string;
  queryNames?: string[];
}

export class BaseGraphqlServiceOptions {
  production?: boolean;
}

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class BaseGraphqlService<T = any, F = any, ID = any> {

  protected _debug: boolean;
  protected _logPrefix: string;
  protected _mutableWatchQueries: MutableWatchQueryDescription<any>[] = [];

  // Max updated queries, for this entity.
  // - Can be override by subclasses (in constructor)
  // - Use value -1 for no max size
  // - Default value to 3, because it usually enough (e.g. OperationService and LandingService need at least 2)
  protected _mutableWatchQueriesMaxCount = 3;

  protected constructor(
    protected graphql: GraphqlService,
    @Optional() options?: BaseGraphqlServiceOptions
  ) {

    // for DEV only
    this._debug = toBoolean(options && !options.production, !environment.production);
    this._logPrefix = `[${changeCaseToUnderscore(this.constructor.name).replace(/_/g, '-' )}]`;
  }

  mutableWatchQuery<D, V = EmptyObject>(opts: MutableWatchQueryOptions<D, T, V>): Observable<D> {

    if (!opts.arrayFieldName) {
      return this.graphql.watchQuery(opts);
    }
    // Create the query id
    const queryId = this.computeMutableWatchQueryId(opts);
    const exactMatchQueries = this._mutableWatchQueries.filter(q => q.id === queryId);

    let mutableQuery: MutableWatchQueryDescription<D, T, V>;
    let queryRef: QueryRef<D, V>;

    if (exactMatchQueries.length === 1) {
      mutableQuery = exactMatchQueries[0] as MutableWatchQueryDescription<D, T, V>;
      mutableQuery.counter += 1;
      queryRef = mutableQuery.queryRef;
      if (this._debug) console.debug(this._logPrefix + `Find same mutable watch query (same variables) {${queryId}}. Skip register`);

      // Refetch if need
      if (opts.fetchPolicy && (opts.fetchPolicy === 'network-only' || opts.fetchPolicy === 'no-cache' || opts.fetchPolicy === 'cache-and-network')) {
        queryRef.refetch(mutableQuery.variables);
      }
      //if (mutableQuery.counter > 3) {
      //  console.warn(this._debugPrefix + 'TODO: clean previous queries with name: ' + queryName);
      //}
    }
    else {
      queryRef = this.graphql.watchQueryRef<D, V>(opts);
      this.registerNewMutableWatchQuery({
        id: queryId,
        query: opts.query,
        queryRef,
        variables: opts.variables,
        arrayFieldName: opts.arrayFieldName,
        insertFilterFn: opts.insertFilterFn,
        sortFn: opts.sortFn,
        counter: 1
      });
    }

    return this.graphql.queryRefValuesChanges(queryRef, opts);
  }

  insertIntoMutableCachedQuery(cache: ApolloCache<any>, opts: {
    query?: any;
    queryName?: string;
    data?: T[] | T;
  }) {
    const queries = this.findMutableWatchQueries(opts);
    if (!queries.length)  return;

    queries.forEach(query => {

        if (opts.data instanceof Array) {
          // Filter values, if a filter function exists
          const data = query.insertFilterFn ? opts.data.filter(i => query.insertFilterFn(i)) : opts.data;
          if (isNotEmptyArray(data)) {
            if (this._debug) console.debug(`[base-data-service] Inserting data into watching query: `, query.id);
            this.graphql.addManyToQueryCache(cache, {
              query: query.query,
              variables: query.variables,
              arrayFieldName: query.arrayFieldName as string,
              sortFn: query.sortFn,
              data
            });
          }
        }
        // Filter value, if a filter function exists
        else if (!query.insertFilterFn || query.insertFilterFn(opts.data)) {
          if (this._debug) console.debug(`[base-data-service] Inserting data into watching query: `, query.id);
          this.graphql.insertIntoQueryCache(cache, {
            query: query.query,
            variables: query.variables,
            arrayFieldName: query.arrayFieldName as string,
            sortFn: query.sortFn,
            data: opts.data
          });
        }
      });
  }

  removeFromMutableCachedQueryByIds(cache: ApolloCache<any>, opts: FindMutableWatchQueriesOptions & {
    ids: ID|ID[];
  }): number {
    const queries = this.findMutableWatchQueries(opts);
    if (!queries.length )  return;

    console.debug(`[base-data-service] Removing data from watching queries: `, queries);
    return queries.map(query => {
      if (opts.ids instanceof Array) {
        return this.graphql.removeFromCachedQueryByIds(cache, {
          query: query.query,
          variables: query.variables,
          arrayFieldName: query.arrayFieldName as string,
          ids: opts.ids
        });
      }
      else {
        return this.graphql.removeFromCachedQueryById(cache, {
          query: query.query,
          variables: query.variables,
          arrayFieldName: query.arrayFieldName as string,
          ids: opts.ids
        }) ? 1 : 0;
      }
    })
    // Sum
    .reduce((res, count) => res + count, 0);
  }

  async refetchMutableQuery(opts: FindMutableWatchQueriesOptions & { variables?: any }): Promise<void> {
    // Retrieve queries to refetch
    const queries = this.findMutableWatchQueries(opts);

    // Skip if nothing to refetech
    if (!queries.length) return;

    try {
      await Promise.all(queries.map(query => {
        if (this._debug) console.debug(this._logPrefix + `Refetching mutable watch query {${query.id}}`);
        return query.queryRef.refetch(opts.variables);
      }));
    }
    catch (err) {
      console.error(this._logPrefix + 'Error while refetching mutable watch queries', err);
    }
  }

  /* -- protected methods -- */

  protected computeMutableWatchQueryId<D, T, V = EmptyObject>(opts: MutableWatchQueryOptions<D, T, V>) {
    const queryName = opts.queryName || sha256().update(JSON.stringify(opts.query)).digest('hex').substring(0, 8);
    const variablesKey = opts.variables && sha256().update(JSON.stringify(opts.variables)).digest('hex').substring(0, 8) || '';
    return [queryName, opts.arrayFieldName, variablesKey].join('|');
  }

  protected findMutableWatchQueries(opts: FindMutableWatchQueriesOptions): MutableWatchQueryDescription<any>[] {
    // Search by queryName
    if (opts.queryName) {
      return this._mutableWatchQueries.filter(q => q.id.startsWith(opts.queryName + '|'));
    }
    if (opts.queryNames) {
      return opts.queryNames.reduce((res, queryName) => res.concat(this._mutableWatchQueries.filter(q => q.id.startsWith(queryName + '|'))), []);
    }

    // Search by query
    if (opts.query) {
      return this._mutableWatchQueries.filter(q => q.query === opts.query);
    }
    if (opts.queries) {
      return opts.queries.reduce((res, query) => res.concat(this._mutableWatchQueries.filter(q => q.query === query)), []);
    }
    throw Error('Invalid options: only one property must be set');
  }

  protected registerNewMutableWatchQuery(mutableQuery: MutableWatchQueryDescription<any>) {

    if (this._debug) console.debug(this._logPrefix + `Register new mutable watch query {${mutableQuery.id}}`);

    // If exceed the max size of mutable queries: remove some
    if (this._mutableWatchQueriesMaxCount > 0 && this._mutableWatchQueries.length >= this._mutableWatchQueriesMaxCount) {
      const removedWatchQueries = this._mutableWatchQueries.splice(0, 1 + this._mutableWatchQueries.length - this._mutableWatchQueriesMaxCount);

      // Warn, as it shouldn't be happen often, when max is correctly set
      console.warn(this._logPrefix + `Removing older mutable watching queries (stack exceed max of ${this._mutableWatchQueriesMaxCount}): `,
        removedWatchQueries.map(q => q.id));
    }

    // Define the sort function (to be used in insertIntoMutableCachedQuery())
    if (!mutableQuery.sortFn && mutableQuery.variables && mutableQuery.variables.sortBy) {
      mutableQuery.sortFn = mutableQuery.variables && mutableQuery.variables.sortBy
      && EntityUtils.sortComparator(mutableQuery.variables.sortBy, mutableQuery.variables.sortDirection || 'asc');
    }

    // Add the new mutable query to array
    this._mutableWatchQueries.push(mutableQuery);
  }
}
