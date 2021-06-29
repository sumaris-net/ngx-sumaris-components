import {Inject, Injectable} from '@angular/core';
import {gql} from '@apollo/client/core';
import {ErrorCodes} from './errors';
import {AccountService} from '../../core/services/account.service';
import {GraphqlService} from '../../core/graphql/graphql.service';
import {Observable, of} from 'rxjs';
import {UserEvent, UserEventAction, UserEventTypes} from './model/user-event.model';
import {SocialFragments} from './social.fragments';
import {SortDirection} from '@angular/material/sort';
import {EntitiesServiceWatchOptions, EntityServiceLoadOptions, FilterFn, IEntitiesService, LoadResult, Page} from '../../shared/services/entity-service.class';
import {map} from 'rxjs/operators';
import {isEmptyArray, isNil, isNilOrBlank, toNumber} from '../../shared/functions';
import {ShowToastOptions, Toasts} from '../../shared/toasts';
import {OverlayEventDetail} from '@ionic/core';
import {ToastController} from '@ionic/angular';
import {TranslateService} from '@ngx-translate/core';
import {NetworkService} from '../../core/services/network.service';
import {BaseGraphqlService} from '../../core/services/base-graphql-service.class';
import {Entity, EntityUtils} from '../../core/services/model/entity.model';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {EntityFilter} from '../../core/services/model/filter.model';
import {EntityClass} from '../../core/services/model/entity.decorators';

// @dynamic
@EntityClass({typename: 'UserEventVO'})
export class UserEventFilter extends EntityFilter<UserEventFilter, UserEvent> {

  static fromObject: (source: any, opts?: any) => UserEventFilter;

  issuer: string = null;
  recipient: string = null;

  fromObject(source: any, opts?: any) {
    super.fromObject(source, opts);
    this.issuer = source.issuer;
    this.recipient = source.recipient;
  }

  protected buildFilter(): FilterFn<UserEvent>[] {
    const filterFns = super.buildFilter();

    // issuer
    if (this.issuer) {
      filterFns.push(t => (t.issuer === this.issuer));
    }
    if (this.recipient) {
      filterFns.push(t => (t.recipient === this.recipient));
    }

    return filterFns;
  }
}

const SaveQuery: any = gql`
  mutation SaveUserEvent($data: UserEventVOInput){
    data: saveUserEvent(userEvent: $data){
      ...UserEventFragment
    }
  }
  ${SocialFragments.userEvent}
`;

const LoadAllQuery: any = gql`
  query UserEvents($filter: UserEventFilterVOInput, $page: PageInput){
    data: userEvents(filter: $filter, page: $page){
      ...LightUserEventFragment
    }
  }
  ${SocialFragments.lightUserEvent}
`;

const DeleteByIdsMutation: any = gql`
  mutation DeleteUserEvents($ids:[Int]){
    deleteUserEvents(ids: $ids)
  }
`;

const LoadAllWithContentQuery: any = gql`
  query UserEventsWithContent($filter: UserEventFilterVOInput, $page: PageInput){
    data: userEvents(filter: $filter, page: $page){
      ...UserEventFragment
    }
  }
  ${SocialFragments.userEvent}
`;

export declare interface UserEventWatchOptions extends EntitiesServiceWatchOptions {
  withContent?: boolean; // Default to false
}

export interface UserEventActionDefinition extends UserEventAction<any> {
  __typename: string;
}

@Injectable({providedIn: 'root'})
export class UserEventService
  extends BaseGraphqlService<UserEvent, UserEventFilter>
  implements IEntitiesService<UserEvent, UserEventFilter, UserEventWatchOptions> {

  private _userEventActions: UserEventActionDefinition[] = [];

  constructor(
    protected graphql: GraphqlService,
    protected accountService: AccountService,
    protected network: NetworkService,
    protected translate: TranslateService,
    protected toastController: ToastController,
    @Inject(ENVIRONMENT) protected environment,
  ) {
    super(graphql, environment);

    // For DEV only
    this._debug = !environment.production;
  }

  /**
   *
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param filter
   * @param options
   * @deprecated use watchPage() instead
   */
  watchAll(offset: number,
           size: number,
           sortBy?: string,
           sortDirection?: SortDirection,
           filter?: UserEventFilter,
           options?: UserEventWatchOptions): Observable<LoadResult<UserEvent>> {
    return this.watchPage(<Page>{offset, size, sortBy, sortDirection}, filter, options);
  }

  watchPage(page: Page,
            filter?: Partial<UserEventFilter>,
            options?: UserEventWatchOptions): Observable<LoadResult<UserEvent>> {

    let now = this._debug && Date.now();
    //if (this._debug)
    console.debug('[user-event-service] Loading user events...', filter);

    filter = this.asFilter(filter);

    // Force recipient to current issuer, if not admin and not specified
    if (isNilOrBlank(filter.recipient) || !this.accountService.isAdmin()) {
      const recipient = this.accountService.account.pubkey;
      if (recipient !== filter.recipient) {
        console.warn('[user-events-service] Force user event filter.recipient=' + recipient);
        filter.recipient = recipient;
      }
    }

    const withContent = options && options.withContent === true;

    return this.mutableWatchQuery<LoadResult<any>>({
      queryName: withContent ? 'LoadAllWithContent' : 'LoadAll',
      query: withContent ? LoadAllWithContentQuery : LoadAllQuery,
      variables: {
        page: {
          sortBy: 'updateDate',
          ...page,
          sortDirection: (page.sortDirection || 'DESC').toUpperCase(),
        },
        filter: filter && filter.asPodObject()
      },
      arrayFieldName: 'data',
      error: {code: ErrorCodes.LOAD_USER_EVENTS_ERROR, message: 'SOCIAL.ERROR.LOAD_USER_EVENTS_ERROR'},
      fetchPolicy: options && options.fetchPolicy || undefined
    })
      .pipe(
        map(res => {
          const data = res && (res.data || []).map(UserEvent.fromObject);

          if (now) {
            console.debug(`[user-event-service] ${data.length} user events loaded in ${Date.now() - now}ms`);
            now = null;
          }
          return {
            data,
            total: res && toNumber(res.total, data.length)
          };
        })
      );
  }

  saveAll(data: UserEvent[], options?: any): Promise<UserEvent[]> {
    return Promise.all(data
      .map(entity => this.save(entity, options))
    );
  }

  /**
   * Save a userEvent entity
   *
   * @param entity
   */
  async save(entity: UserEvent, options?: EntityServiceLoadOptions): Promise<UserEvent> {

    this.fillDefaultProperties(entity);

    // Transform into json
    const isNew = isNil(entity.id);
    const json = entity.asObject();

    const now = Date.now();
    if (this._debug) console.debug(`[user-event-service] Saving user event...`, json);

    await this.graphql.mutate<{ data: any }>({
      mutation: SaveQuery,
      variables: {
        data: json
      },
      error: { code: ErrorCodes.SAVE_USER_EVENT_ERROR, message: 'SOCIAL.ERROR.SAVE_USER_EVENT_ERROR' },
      update: (proxy, {data}) => {
        // Update entity
        const savedEntity = data && data.data;
        if (savedEntity) {
          if (this._debug) console.debug(`[user-event-service] User event saved in ${Date.now() - now}ms`, entity);
          this.copyIdAndUpdateDate(savedEntity, entity);

          // Add to cache
          if (isNew) {
            this.insertIntoMutableCachedQuery(proxy,{
              query: LoadAllQuery,
              data: {
                ...savedEntity,
                content: null
              }
            });
            this.insertIntoMutableCachedQuery(proxy,{
              query: LoadAllWithContentQuery,
              data: savedEntity
            });
          }
        }
      }
    });

    return entity;
  }



  /**
   * Save many trips
   *
   * @param entities
   * @param opts
   */
  async deleteAll(entities: UserEvent[], opts?: {
    trash?: boolean; // True by default
  }): Promise<any> {

    const ids = entities && entities
      .map(t => t.id);
    if (isEmptyArray(ids)) return; // stop, if nothing else to do

    const now = Date.now();
    if (this._debug) console.debug('[user-event-service] Deleting events... ids:', ids);

    await this.graphql.mutate<any>({
      mutation: DeleteByIdsMutation,
      variables: {
        ids
      },
      update: (proxy) => {
        // Remove from caches
        this.removeFromMutableCachedQueryByIds(proxy, {
          query: LoadAllQuery,
          ids
        });
        this.removeFromMutableCachedQueryByIds(proxy, {
          query: LoadAllWithContentQuery,
          ids
        });

        if (this._debug) console.debug(`[user-event-service] Events deleted in ${Date.now() - now}ms`);
      }
    });
  }

  /**
   * Delete userEvent entities
   */
  async delete(data: UserEvent): Promise<any> {
    if (!data) return; // skip
    await this.deleteAll([data]);
  }

  listenChanges(id: number, options?: any): Observable<UserEvent | undefined> {
    // TODO
    console.warn('TODO: implement listen changes on user events');
    return of();
  }

  registerAction(definition: UserEventActionDefinition) {
    console.info(`[user-event-service] Registering action ${definition.name} for ${definition.__typename}`);
    this._userEventActions.push(definition);
  }

  getActionsByTypename(typename: string): UserEventAction<any>[] {
    return this._userEventActions.filter(def => def.__typename === typename);
  }

  async showToastErrorWithContext(opts: {
    error?: any;
    message?: string;
    context: any | (() => any) | Promise<any>;}) {

    let message = opts.message || (opts.error && opts.error.message || opts.error);

    // Make sure message a string
    if (!message || typeof message !== 'string') {
      message = 'ERROR.UNKNOWN_TECHNICAL_ERROR';
    }

    // If offline, display a simple alert
    if (this.network.offline) {
      this.showToast({message, type: 'error'});
      return;
    }

    // Translate the message (to be able to extract details content)
    message = this.translate.instant(message);

    // Clean details parts
    if (message && message.indexOf('<small>') !== -1) {
      message = message.substr(0, message.indexOf('<small>') - 1);
    }

    const res = await this.showToast({
      type: 'error',
      duration: 15000,
      message: message + '<br/><br/><b>' + this.translate.instant('CONFIRM.SEND_DEBUG_DATA') + '</b>',
      buttons: [{
        icon: 'bug',
        text: this.translate.instant('COMMON.BTN_SEND'),
        role: 'send'
      }]
    });
    if (!res || res.role !== 'send') return;

    // Send debug data
    try {
      if (this._debug) console.debug('Sending debug data...');

      // Call content factory
      let context: any = opts && opts.context;
      if (typeof context === 'function') {
        context = context();
      }
      if (context instanceof Promise) {
        context = await context;
      }

      // Send the message
      const userEvent = await this.sendDataForDebug({
        message,
        error: opts.error || undefined,
        context: this.convertObjectToString(context)
      });

      console.info('Debug data successfully sent to admin', userEvent);
      this.showToast({
        type: 'info',
        message: 'INFO.DEBUG_DATA_SEND',
        showCloseButton: true
      });
    }
    catch (err) {
      console.error('Error while sending debug data:', err);
    }
  }

  sendDataForDebug(data: any): Promise<UserEvent> {
    const userEvent = new UserEvent();
    userEvent.eventType = UserEventTypes.DEBUG_DATA;
    userEvent.content = this.convertObjectToString(data);
    return this.save(userEvent);
  }

  asFilter(filter: Partial<UserEventFilter>): UserEventFilter {
    return UserEventFilter.fromObject(filter);
  }

  /* -- protected methods -- */

  protected convertObjectToString(data: any): string {
    if (typeof data === 'string'){
      return data;
    }
    // Serialize content into string
    else if (typeof data === 'object'){
      if (data instanceof Entity) {
        return JSON.stringify(data.asObject({keepTypename: true, keepLocalId: true, minify: false}));
      }
      else {
        return JSON.stringify(data);
      }
    }
  }

  protected async showToast<T=any>(opts: ShowToastOptions): Promise<OverlayEventDetail<T>> {
    if (!this.toastController) throw new Error('Missing toastController in component\'s constructor');
    return await Toasts.show(this.toastController, this.translate, opts);
  }

  protected fillDefaultProperties(entity: UserEvent) {
    entity.issuer = this.accountService.account.pubkey;

    // TODO: compute hash (using cryptoService)
    // TODO: compute sign
    console.warn('TODO: sign user event before sending');
  }

  protected copyIdAndUpdateDate(source: UserEvent, target: UserEvent) {
    EntityUtils.copyIdAndUpdateDate(source, target);
  }
}
