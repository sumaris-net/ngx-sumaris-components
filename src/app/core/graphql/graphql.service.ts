import {Observable, of, Subject, Subscription} from 'rxjs';
import {Apollo, ExtraSubscriptionOptions, QueryRef} from 'apollo-angular';
import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  ApolloQueryResult,
  FetchPolicy,
  InMemoryCache,
  MutationUpdaterFn,
  OperationVariables,
  TypePolicies,
  WatchQueryFetchPolicy
} from '@apollo/client/core';
import {ErrorCodes, ServerErrorCodes, ServiceError} from '../services/errors';
import {catchError, distinctUntilChanged, filter, first, map, mergeMap, throttleTime} from 'rxjs/operators';

import {Inject, Injectable, InjectionToken, Optional} from '@angular/core';
import {ConnectionType, NetworkService} from '../services/network.service';
import {WebSocketLink} from '@apollo/client/link/ws';
import {
  AppWebSocket,
  createTrackerLink,
  isMutationOperation,
  isSubscriptionOperation,
  restoreTrackedQueries
} from './graphql.utils';
import {Storage} from '@ionic/storage';
import {RetryLink} from '@apollo/client/link/retry';
import QueueLink from 'apollo-link-queue';
import SerializingLink from 'apollo-link-serialize';
import loggerLink from 'apollo-link-logger';
import {Platform} from '@ionic/angular';
import {EntityUtils, IEntity} from '../services/model/entity.model';
import {isNil, isNotNil, toNumber} from '../../shared/functions';
import {Resolvers} from '@apollo/client/core/types';
import {HttpHeaders} from '@angular/common/http';
import {EmptyObject} from 'apollo-angular/types';
import {HttpLink, Options} from 'apollo-angular/http';
import {IonicStorageWrapper, persistCache} from 'apollo3-cache-persist';
import {PersistentStorage} from 'apollo3-cache-persist/lib/types';
import {ErrorPolicy, MutationBaseOptions} from '@apollo/client/core/watchQueryOptions';
import {Cache} from '@apollo/client/cache/core/types/Cache';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {CryptoService} from '../services/crypto.service';
import {ConnectionParamsOptions} from 'subscriptions-transport-ws/dist/client';

export interface WatchQueryOptions<V> {
  query: any;
  variables?: V;
  error?: ServiceError;
  fetchPolicy?: WatchQueryFetchPolicy;
}

export interface MutateQueryOptions<T, V = OperationVariables> extends MutationBaseOptions<T, V> {
  mutation: any;
  variables?: V;
  error?: ServiceError;
  context?: {
    serializationKey?: string;
    tracked?: boolean;
    timeout?: number;
  };
  optimisticResponse?: T;
  offlineResponse?: T | ((context: any) => Promise<T>);
  update?: MutationUpdaterFn<T>;
  forceOffline?: boolean;
}

export const APP_GRAPHQL_TYPE_POLICIES = new InjectionToken<TypePolicies>('graphqlTypePolicies');


@Injectable({
  providedIn: 'root'
})
export class GraphqlService {

  private readonly _debug: boolean;
  private _started = false;
  private _startPromise: Promise<any>;
  private _subscription = new Subscription();
  private readonly _networkStatusChanged$: Observable<ConnectionType>;

  private httpParams: Options;
  private wsParams: WebSocketLink.Configuration;
  private connectionParams: ConnectionParamsOptions & {
    authToken?: string;
    authBasic?: string;
  } = {};
  private readonly _defaultFetchPolicy: WatchQueryFetchPolicy;
  private onNetworkError = new Subject();
  private customErrors: {code: number; message: string}[] = [];

  public onStart = new Subject<void>();


  get started(): boolean {
    return this._started;
  }

  get client(): ApolloClient<any> {
    return this.apollo.client;
  }

  get cache(): ApolloCache<any> {
    return this.apollo.client.cache;
  }

  constructor(
    private platform: Platform,
    private apollo: Apollo,
    private httpLink: HttpLink,
    private network: NetworkService,
    private storage: Storage,
    private cryptoService: CryptoService,
    @Inject(ENVIRONMENT) protected environment,
    @Optional() @Inject(APP_GRAPHQL_TYPE_POLICIES) private typePolicies: TypePolicies
  ) {

    this._debug = !environment.production;
    this._defaultFetchPolicy = environment.apolloFetchPolicy;

    // Restart if network restart
    this.network.on('start', () => this.restart());

    // Clear cache
    this.network.on('resetCache', async () => {
      await this.ready();
      await this.clearCache();
    });

    // Listen network status
    this._networkStatusChanged$ = network.onNetworkStatusChanges
      .pipe(
        filter(isNotNil),
        distinctUntilChanged()
      );

    // When getting network error: try to ping peer, and toggle to offline
    this.onNetworkError
      .pipe(
        throttleTime(300),
        filter(() => this.network.online),
        mergeMap(() => this.network.checkPeerAlive()),
        filter(alive => !alive)
      )
      .subscribe(() => this.network.setForceOffline(true, {showToast: true}));

  }

  ready(): Promise<void> {
    if (this._started) return Promise.resolve();
    return this.start();
  }

  start(): Promise<void> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return Promise.resolve();

    console.info('[graphql] Starting graphql...');

    // Waiting for network service
    this._startPromise = this.network.ready()
      .then(() => this.initApollo())
      .then(() => {
        this._started = true;
        this._startPromise = undefined;

        // Emit event
        this.onStart.next();

        console.info('[graphql] Starting graphql [OK]');
      })
      .catch((err) => {
        console.error(err && err.message || err, err);
        this._startPromise = undefined;
      });
    return this._startPromise;
  }

  setAuthToken(token: string) {
    if (token) {
      console.debug('[graphql] Apply token authentication to headers');
      this.connectionParams.authToken = token;
    } else {
      console.debug('[graphql] Remove token authentication from headers');
      delete this.connectionParams.authToken;
      // Clear cache
      this.clearCache();
    }
  }

  setAuthBasic(basic: string) {
    if (basic) {
      console.debug('[graphql] Apply basic authentication to headers');
      this.connectionParams.authBasic = basic;
    } else {
      console.debug('[graphql] Remove basic authentication from headers');
      delete this.connectionParams.authBasic;
      // Clear cache
      this.clearCache();
    }
  }

  /**
   * Allow to add a field resolver
   *  (see doc: https://www.apollographql.com/docs/react/data/local-state/#handling-client-fields-with-resolvers)
   *
   * @param resolvers
   */
  async addResolver(resolvers: Resolvers | Resolvers[]) {
    if (!this._started) {
      this.onStart.toPromise().then(() => this.addResolver(resolvers)); // Loop
    }
    const client = this.apollo.getClient();
    client.addResolvers(resolvers);
  }

  async query<T, V = EmptyObject>(opts: {
    query: any;
    variables?: V;
    error?: ServiceError;
    fetchPolicy?: FetchPolicy;
  }): Promise<T> {
    let res;
    try {
      res = await (await this.getApollo()).query<ApolloQueryResult<T>, V>({
        query: opts.query,
        variables: opts.variables,
        fetchPolicy: opts.fetchPolicy || (this._defaultFetchPolicy as FetchPolicy) || undefined
      }).toPromise();
    } catch (err) {
      res = this.toApolloError<T>(err, opts.error);
    }
    if (res.errors) {
      throw res.errors[0];
    }
    return res.data;
  }

  watchQueryRef<T, V = EmptyObject>(opts: WatchQueryOptions<V>): QueryRef<T, V> {
    return this.apollo.watchQuery<T, V>({
      query: opts.query,
      variables: opts.variables,
      fetchPolicy: opts.fetchPolicy || (this._defaultFetchPolicy as FetchPolicy) || undefined,
      notifyOnNetworkStatusChange: true
    });
  }

  queryRefValuesChanges<T, V = EmptyObject>(queryRef: QueryRef<T, V>, opts: WatchQueryOptions<V>): Observable<T> {
    return queryRef
      .valueChanges
      .pipe(
        catchError(error => this.onApolloError<T>(error, opts.error)),
        map(({data, errors}) => {
          if (errors) {
            throw errors[0];
          }
          return data;
        })
      );
  }

  watchQuery<T, V = EmptyObject>(opts: WatchQueryOptions<V>): Observable<T> {
    const queryRef: QueryRef<T, V> = this.watchQueryRef(opts);
    return this.queryRefValuesChanges(queryRef, opts);
  }

  async mutate<T, V = EmptyObject>(opts: MutateQueryOptions<T, V>): Promise<T> {

    // If offline, compute an optimistic response for tracked queries
    if ((opts.forceOffline || this.network.offline) && opts.offlineResponse) {
      if (typeof opts.offlineResponse === 'function') {
        opts.context = opts.context || {};
        const optimisticResponseFn = (opts.offlineResponse as ((context: any) => Promise<T>));
        opts.optimisticResponse = await optimisticResponseFn(opts.context);
        if (this._debug) console.debug('[graphql] [offline] Using an optimistic response: ', opts.optimisticResponse);
      }
      else {
        opts.optimisticResponse = opts.offlineResponse as T;
      }
      if (opts.forceOffline) {
        const res = {data: opts.optimisticResponse};
        if (opts.update) {
          opts.update(this.apollo.client.cache, res);
        }
        return res.data;
      }
    }

    const res = await this.apollo.mutate<ApolloQueryResult<T>, V>({
      mutation: opts.mutation,
      variables: opts.variables,
      context: opts.context,
      optimisticResponse: opts.optimisticResponse as any,
      update: opts.update as any
    })
      .pipe(
        catchError(error => this.onApolloError<T>(error, opts.error)),
        first(),
        // To debug, if need:
        //tap((res) => (!res) && console.error('[graphql] Unknown error during mutation. Check errors in console (may be an invalid generated cache id ?)'))
      ).toPromise();
    if (res.errors instanceof Array) {
      throw res.errors[0];
    }
    return res.data as T;
  }

  subscribe<T, V = EmptyObject>(opts: {
    query: any;
    variables: V;
    fetchPolicy?: FetchPolicy;
    errorPolicy?: ErrorPolicy;
    error?: ServiceError;
  }, extra?: ExtraSubscriptionOptions): Observable<T> {

    return this.apollo.subscribe<T>({
      query: opts.query,
      fetchPolicy: opts && opts.fetchPolicy || 'network-only',
      errorPolicy: opts && opts.errorPolicy || undefined,
      variables: opts.variables
    }, {
      useZone: true,
      ...extra
    })
      .pipe(
        catchError(error => this.onApolloError<T>(error, opts.error)),
        map(({data, errors}) => {
          if (errors) {
            throw errors[0];
          }
          return data;
        })
      );
  }

  insertIntoQueryCache<T, V = EmptyObject>(cache: ApolloCache<any>,
                                           opts: Cache.ReadQueryOptions<V, any> & {
                                             arrayFieldName: string;
                                             totalFieldName?: string;
                                             data: T;
                                             sortFn?: (d1: T, d2: T) => number;
                                             size?: number;
                                           }) {

    cache = cache || this.apollo.client.cache;
    opts.arrayFieldName = opts.arrayFieldName || 'data';

    try {
      let data = cache.readQuery<any, V>({query: opts.query, variables: opts.variables});

      if (data && data[opts.arrayFieldName]) {
        // Copy because immutable
        data = { ...data };

        // Append to result array
        data[opts.arrayFieldName] = [ ...data[opts.arrayFieldName], {...opts.data}];

        // Resort, if need
        if (opts.sortFn) {
          data[opts.arrayFieldName].sort(opts.sortFn);
        }

        // Exclude if exceed max size
        const size = toNumber(opts.variables && opts.variables['size'], -1);
        if (size > 0 && data[opts.arrayFieldName].length > size) {
          data[opts.arrayFieldName].splice(size, data[opts.arrayFieldName].length - size);
        }

        // Increment total
        if (isNotNil(opts.totalFieldName)) {
          if (isNotNil(data[opts.totalFieldName])) {
            data[opts.totalFieldName] += 1;
          }
          else {
            console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.totalFieldName);
          }
        }

        cache.writeQuery({
          query: opts.query,
          variables: opts.variables,
          data
        });
      }
      else {
        console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.arrayFieldName);
      }
    } catch (err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
      if (this._debug) console.error('[graphql] Error while updating cache: ', err);
    }
  }

  addManyToQueryCache<T = any, V = EmptyObject>(cache: ApolloCache<any>,
                                                opts: Cache.ReadQueryOptions<V, any> & {
                                                  arrayFieldName: string;
                                                  totalFieldName?: string;
                                                  data: T[];
                                                  equalsFn?: (d1: T, d2: T) => boolean;
                                                  sortFn?: (d1: T, d2: T) => number;
                                                }) {

    if (!opts.data || !opts.data.length) return; // nothing to process

    cache = cache || this.apollo.client.cache;
    opts.arrayFieldName = opts.arrayFieldName || 'data';

    try {
      let data = cache.readQuery<any, V>({query: opts.query, variables: opts.variables});

      if (data && data[opts.arrayFieldName]) {
        // Copy because immutable
        data = { ...data };

        // Keep only not existing res
        const equalsFn = opts.equalsFn || ((d1, d2) => d1['id'] === d2['id'] && d1['entityName'] === d2['entityName']);
        const newItems = opts.data.filter(inputValue => data[opts.arrayFieldName].findIndex(existingValue => equalsFn(inputValue, existingValue)) === -1);

        if (!newItems.length) return; // No new value

        // Append to array
        data[opts.arrayFieldName] = [ ...data[opts.arrayFieldName], ...newItems];

        // Resort, if need
        if (opts.sortFn) {
          data[opts.arrayFieldName].sort(opts.sortFn);
        }

        // Exclude if exceed max size
        const size = toNumber(opts.variables && opts.variables['size'], -1);
        if (size > 0 && data[opts.arrayFieldName].length > size) {
          data[opts.arrayFieldName].splice(size, data[opts.arrayFieldName].length - size);
        }

        // Increment the total
        if (isNotNil(opts.totalFieldName)) {
          if (isNotNil(data[opts.totalFieldName])) {
            data[opts.arrayFieldName] += newItems.length;
          }
          else {
            console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.totalFieldName);
          }
        }

        // Write to cache
        cache.writeQuery({
          query: opts.query,
          variables: opts.variables,
          data
        });
      }
      else {
        console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.arrayFieldName);
      }
    } catch (err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
      if (this._debug) console.warn('[graphql] Error while updating cache: ', err);
    }
  }

  /**
   * Remove from cache, and return if removed or not
   *
   * @param cache
   * @param opts
   */
  removeFromCachedQueryById<V = EmptyObject, ID = number>(cache: ApolloCache<any>,
                                                          opts: Cache.ReadQueryOptions<V, any> & {
                                                            arrayFieldName: string;
                                                            totalFieldName?: string;
                                                            ids: ID; // Do NOT use 'id', as already used by the Apollo API
                                                          }): boolean {

    cache = cache || this.apollo.client.cache;
    opts.arrayFieldName = opts.arrayFieldName || 'data';

    try {
      let data = cache.readQuery<any, V>({query: opts.query, variables: opts.variables});

      if (data && data[opts.arrayFieldName]) {
        // Copy because immutable
        data = { ...data };

        const index = data[opts.arrayFieldName].findIndex(item => item['id'] === opts.ids);
        if (index === -1) return false; // Skip (nothing removed)

        // Copy, then remove deleted item
        data[opts.arrayFieldName] = data[opts.arrayFieldName].slice();
        const deletedItem = data[opts.arrayFieldName].splice(index, 1)[0];
        cache.evict({id: cache.identify(deletedItem)});

        // Decrement the total
        if (isNotNil(opts.totalFieldName)) {
          if (isNotNil(data[opts.totalFieldName])) {
            data[opts.totalFieldName] -= 1;
          }
          else {
            console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.totalFieldName);
          }
        }

        // Write to cache
        cache.writeQuery({
          query: opts.query,
          variables: opts.variables,
          data
        });
        return true;
      }
      else {
        console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.arrayFieldName);
        return false;
      }
    } catch (err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
      if (this._debug) console.warn('[graphql] Error while removing from cache: ', err);
      return false;
    }
  }

  /**
   * Remove ids from cache, and return the number of items removed
   *
   * @param cache
   * @param opts
   */
  removeFromCachedQueryByIds<V = EmptyObject, ID = number>(cache: ApolloCache<any>,
                                                           opts: Cache.ReadQueryOptions<V, any> & {
                                                             arrayFieldName: string;
                                                             totalFieldName?: string;
                                                             ids: ID[];
                                                           }): number {

    cache = cache || this.apollo.client.cache;
    opts.arrayFieldName = opts.arrayFieldName || 'data';

    try {
      let data = cache.readQuery(opts);

      if (data && data[opts.arrayFieldName]) {
        // Copy because immutable
        data = { ...data };

        const deletedIndexes = data[opts.arrayFieldName].reduce((res, item, index) => opts.ids.includes(item['id']) ? res.concat(index) : res, []);

        if (deletedIndexes.length <= 0) return 0; // Skip (nothing removed)

        // Query has NO total
        if (isNil(opts.totalFieldName)) {

          // Evict each object
          deletedIndexes
            .map(index => data[opts.arrayFieldName][index])
            .map(item => cache.identify(item))
            .forEach(id => cache.evict({id}));

        }
        // Query has a total
        else {
          // Copy the array
          data[opts.arrayFieldName] = data[opts.arrayFieldName].slice();

          // remove from array, then evict
          deletedIndexes
            // Reverse: to keep valid index
            .reverse()
            // Remove from the array
            .map(index => data[opts.arrayFieldName].splice(index, 1)[0])
            // Evict from cache
            .map(item => cache.identify(item))
            .forEach(id => cache.evict({id}));

          if (isNotNil(data[opts.totalFieldName])) {
            data[opts.totalFieldName] -= deletedIndexes.length; // Remove deletion count
          }
          else {
            console.warn('[graphql] Unable to update the total in cached query. Unknown result part: ' + opts.totalFieldName);
          }

          cache.writeQuery({
            query: opts.query,
            variables: opts.variables,
            data
          });

          return deletedIndexes.length;
        }
      }
      else {
        console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.arrayFieldName);
        return 0;
      }
    } catch (err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
      if (this._debug) console.warn('[graphql] Error while removing from cache: ', err);
      return 0;
    }
  }

  updateToQueryCache<T extends IEntity<any>,
    V = EmptyObject>(cache: ApolloCache<any>,
                     opts: Cache.ReadQueryOptions<V, any> & {
                       arrayFieldName: string;
                       totalFieldName?: string;
                       data: T;
                       equalsFn?: (d1: T, d2: T) => boolean;
                     }) {
    cache = cache || this.apollo.client.cache;
    opts.arrayFieldName = opts.arrayFieldName || 'data';

    try {
      let data: any = cache.readQuery(opts);

      if (data && data[opts.arrayFieldName]) {
        // Copy because immutable
        data = { ...data };

        const equalsFn = opts.equalsFn || ((d1, d2) => EntityUtils.equals(d1, d2, 'id'));

        // Update if exists, or insert
        const index = data[opts.arrayFieldName].findIndex(v => equalsFn(opts.data, v));
        if (index !== -1) {
          data[opts.arrayFieldName] = data[opts.arrayFieldName].slice().splice(index, 1, opts.data);
        }
        else {
          data[opts.arrayFieldName] = [ ...data[opts.arrayFieldName], opts.data];
        }

        // Increment total (if changed)
        if (isNotNil(opts.totalFieldName) && index === -1) {
          if (isNotNil(data[opts.totalFieldName])) {
            data[opts.totalFieldName] += 1;
          }
          else {
            console.warn('[graphql] Unable to update cached query. Unknown result part: ' + opts.totalFieldName);
          }
        }

        cache.writeQuery({
          query: opts.query,
          variables: opts.variables,
          data
        });
        return; // OK: stop here
      }
    } catch (err) {
      // continue
      // read in cache is not guaranteed to return a result. see https://github.com/apollographql/react-apollo/issues/1776#issuecomment-372237940
      if (this._debug) console.warn('[graphql] Error while updating cache: ', err);
    }
  }

  async clearCache(client?: ApolloClient<any>): Promise<void> {
    client = (client || this.apollo.client) as ApolloClient<any>;
    if (client) {
      const now = this._debug && Date.now();
      console.info('[graphql] Clearing Apollo client\'s cache... ');
      await client.cache.reset();
      if (this._debug) console.debug(`[graphql] Apollo client's cache cleared, in ${Date.now() - now}ms`);
    }
  }

  registerCustomError(error: {code: number; message: string}) {
    this.customErrors.push(error);
  }

  /* -- protected methods -- */

  protected async initApollo() {

    const mobile = this.platform.is('mobile') || this.platform.is('mobileweb');
    const enableTrackMutationQueries = !mobile;

    const peer = this.network.peer;
    if (!peer) throw Error('[graphql] Missing peer. Unable to start graphql service');

    const uri = peer.url + '/graphql';
    const wsUri = String.prototype.replace.call(uri, /^http(s)?:/, 'ws$1:') + '/websocket';
    console.info('[graphql] Base uri: ' + uri);
    console.info('[graphql] Subscription uri: ' + wsUri);

    this.httpParams = this.httpParams || {};
    this.httpParams.uri = uri;

    this.wsParams = {
      ...this.wsParams,
      options: {
        lazy: true,
        reconnect: true,
        connectionParams: this.connectionParams
      },
      webSocketImpl: AppWebSocket,
      uri: wsUri
    };

    // Create a storage configuration
    const storage: PersistentStorage = new IonicStorageWrapper(this.storage);

    let client = this.apollo.client;
    if (!client) {
      console.debug('[apollo] Creating GraphQL client...');

      // Websocket link
      const wsLink = new WebSocketLink(this.wsParams);

      // Retry when failed link
      const retryLink = new RetryLink();
      const authLink = new ApolloLink((operation, forward) => {

        const authorization = [];
        if (this.connectionParams.authToken) {
          authorization.push(`token ${this.connectionParams.authToken}`);
        }
        if (this.connectionParams.authBasic) {
          authorization.push(`Basic ${this.connectionParams.authBasic}`);
        }
        const headers = new HttpHeaders()
          .append('Authorization', authorization);
        //.append('X-App-Name', environment.name)
        //.append('X-App-Version', environment.version)
        ;


        // Use the setContext method to set the HTTP headers.
        operation.setContext({
          ...operation.getContext(),
          ...{headers}
        });

        // Call the next link in the middleware chain.
        return forward(operation);
      });

      // Http link
      const httpLink = this.httpLink.create(this.httpParams);

      // Cache
      const cache = new InMemoryCache({
        typePolicies: this.typePolicies
      });

      // Add cache persistence
      if (this.environment.persistCache) {
        console.debug('[graphql] Starting persistence cache...');
        await persistCache({
          cache,
          storage,
          trigger: this.platform.is('android') ? 'background' : 'write',
          debounce: 1000,
          debug: true
        });
      }

      let mutationLinks: Array<ApolloLink>;

      // Add queue to store tracked queries, when offline
      if (enableTrackMutationQueries) {
        const serializingLink = new SerializingLink();
        const trackerLink = createTrackerLink({
          storage,
          onNetworkStatusChange: this._networkStatusChanged$,
          debounce: 1000,
          debug: true
        });
        // Creating a mutation queue
        const queueLink = new QueueLink();
        this._subscription.add(this._networkStatusChanged$
          .subscribe(type => {
            // Network is offline: start buffering into queue
            if (type === 'none') {
              console.info('[graphql] offline mode: enable mutations buffer');
              queueLink.close();
            }
            // Network is online
            else {
              console.info('[graphql] online mode: disable mutations buffer');
              queueLink.open();
            }
          }));
        mutationLinks = [
          loggerLink,
          queueLink,
          trackerLink,
          queueLink,
          serializingLink,
          retryLink,
          authLink,
          httpLink
        ];
      }
      else {
        mutationLinks = [
          retryLink,
          authLink,
          httpLink
        ];
      }

      // create Apollo
      client = new ApolloClient({
        cache,
        link:
          ApolloLink.split(
            // Handle mutations
            isMutationOperation,
            ApolloLink.from(mutationLinks),

            ApolloLink.split(
              // Handle subscriptions
              isSubscriptionOperation,
              wsLink,

              // Handle queries
              ApolloLink.from([
                retryLink,
                authLink,
                httpLink
              ])
            )
          ),
        connectToDevTools: !this.environment.production
      });

      this.apollo.client = client;
    }

    // Enable tracked queries persistence
    if (enableTrackMutationQueries && this.environment.persistCache) {

      try {
        await restoreTrackedQueries({
          apolloClient: client,
          storage,
          debug: true
        });
      } catch (err) {
        console.error('[graphql] Failed to restore tracked queries from storage: ' + (err && err.message || err), err);
      }
    }
  }

  protected async stop() {
    console.info('[graphql] Stopping graphql service...');
    this._subscription.unsubscribe();
    this._subscription = new Subscription();
    await this.resetClient();
    this._started = false;
    this._startPromise = undefined;
  }

  protected async restart(): Promise<void> {
    if (this.started) {
      return this.stop().then(() => this.start());
    }
    return this.start();
  }


  protected async resetClient(client?: ApolloClient<any>) {
    client = (client || this.apollo.client) as ApolloClient<any>;
    if (!client) return;

    console.info('[graphql] Resetting apollo client...');
    client.stop();
    await Promise.all([
      client.clearStore(),
      this.clearCache(client)
    ]);
  }

  private onApolloError<T>(err: any, defaultError?: any): Observable<ApolloQueryResult<T>> {
    return of(this.toApolloError(err, defaultError));
  }

  private toApolloError<T>(err: any, defaultError?: any): ApolloQueryResult<T> {
    let error =
      // If network error: try to convert to App (read as JSON), or create an UNKNOWN_NETWORK_ERROR
      (err.networkError && (
          (err.networkError.error && this.toAppError(err.networkError.error))
          || this.toAppError(err.networkError)
          || (err.networkError.error && this.createAppErrorByCode(err.networkError.error.status))
          || this.createAppErrorByCode(ErrorCodes.UNKNOWN_NETWORK_ERROR)
        )
      )
      // If graphQL: try to convert the first error found
      || (err.graphQLErrors && err.graphQLErrors.length && this.toAppError(err.graphQLErrors[0]))
      || this.toAppError(err)
      || this.toAppError(err.originalError)
      || (err.graphQLErrors && err.graphQLErrors[0])
      || err;
    console.error('[graphql] ' + (error && error.message || error), error.stack || '');
    if (error && error.code === ErrorCodes.UNKNOWN_NETWORK_ERROR && err.networkError && err.networkError.message) {
      console.error('[graphql] original error: ' + err.networkError.message);
      this.onNetworkError.next(error);
    }
    if ((!error || !error.code) && defaultError) {
      error = {...defaultError, details: error, stack: err.stack};
    }
    return {
      data: null,
      errors: [error],
      loading: false,
      networkStatus: null
    };
  }

  private createAppErrorByCode(errorCode: number): any | undefined {
    const message = this.getI18nErrorMessageByCode(errorCode);
    if (message) {
      return {
        code: errorCode,
        message: this.getI18nErrorMessageByCode(errorCode)
      };
    }
    return undefined;
  }

  private getI18nErrorMessageByCode(errorCode: number): string | undefined {

    // look in registered error codes
    const customError = this.customErrors.find(error => error.code === errorCode);
    if (customError) {
      return customError.message;
    }

    // Default, switch on error code
    switch (errorCode) {
      case ServerErrorCodes.UNAUTHORIZED:
        return 'ERROR.UNAUTHORIZED';
      case ServerErrorCodes.FORBIDDEN:
        return 'ERROR.FORBIDDEN';
      case ErrorCodes.UNKNOWN_NETWORK_ERROR:
        return 'ERROR.UNKNOWN_NETWORK_ERROR';
      case ServerErrorCodes.BAD_UPDATE_DATE:
        return 'ERROR.BAD_UPDATE_DATE';
      case ServerErrorCodes.DATA_LOCKED:
        return 'ERROR.DATA_LOCKED';
      case ServerErrorCodes.BAD_APP_VERSION:
        return 'ERROR.BAD_APP_VERSION';
    }

    return undefined;
  }

  private toAppError(err: any): any | undefined {
    let error = err;
    const message = err && err.message || err;
    if (typeof message === 'string' && message.trim().indexOf('{"code":') === 0) {
      try {
        error = JSON.parse(err.message);
      }
      catch (parseError) {
        console.error('Unable to parse error as JSON: ', parseError);
      }
    }
    if (error && error.code) {
      return this.createAppErrorByCode(error.code) || error && error.message || error;
    }
    return undefined;
  }


  private async getApollo(): Promise<Apollo> {
    if (!this._started) {
      console.debug('[graphql] Waiting apollo client... ');
      await this.onStart.toPromise();
    }
    return this.apollo;
  }

}
