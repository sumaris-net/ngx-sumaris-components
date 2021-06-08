import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Injector,
  Input,
  OnDestroy,
  OnInit
} from '@angular/core';
import {TableElement} from '@e-is/ngx-material-table';
import {UserEventFilter, UserEventService, UserEventWatchOptions} from '../services/user-event.service';
import {AccountService} from '../../core/services/account.service';
import {UserEvent, UserEventAction, UserEventTypes} from '../services/model/user-event.model';
import {LocalSettingsService} from '../../core/services/local-settings.service';
import {toBoolean} from '../../shared/functions';
import {Moment} from 'moment';
import {AppTable, RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from '../../core/table/table.class';
import {ActivatedRoute, Router} from '@angular/router';
import {ModalController, Platform} from '@ionic/angular';
import {Location} from '@angular/common';
import {EntitiesTableDataSource} from '../../core/table/entities-table-datasource.class';
import {SortDirection} from '@angular/material/sort';
import {EntitiesStorage} from '../../core/services/storage/entities-storage.service';
import {PredefinedColors} from '@ionic/core';
import {IEntity} from '../../core/services/model/entity.model';
import {ENVIRONMENT} from '../../../environments/environment.class';


export interface UserEventDetail<T extends IEntity<T>> {
  title: string;
  description?: string;
  path?: string;

  action?: string | any;
  actionTitle?: string;
  actionColor?: PredefinedColors;

  icon?: string;
  matIcon?: string;
  color?: string;
  cssClass?: string;
  time?: Moment;

  // A config property, to override the title
  titleProperty?: string;
  titleArgs?: {[key: string]: string};

  // conversion
  fromObject?: (source: any) => T;
  childrenFields?: string[];
}
export interface UserEventIcon{
  icon?: string;
  matIcon?: string;
  color?: PredefinedColors;
}
const ICONS_MAP: {[key: string]: UserEventIcon } = {
  DEBUG_DATA: {matIcon: 'bug_report'},
  INBOX_MESSAGE: {matIcon: 'mail'},
};

// TODO: refactor with a registration done by data service:
// - userEventService.registerEventAction({__typename: 'TripVO', ...})
// - userEventService.getActionsFor(__typename): UserEventDetailAction
/*const DETAILS_MAP: {[key: string]: UserEventAction<RootDataEntity<any>>} = {
  "TripVO": {
    icon: null,
    matIcon: "content_copy",
    action: 'copyToLocal',
    actionTitle: 'SOCIAL.USER_EVENT.BTN_COPY_TO_LOCAL',
    actionColor: 'primary',
    fromObject: Trip.fromObject,
    childrenFields: ['operation', 'landing']
  },
  "ObservedLocationVO": {
    icon: null,
    matIcon: "content_copy",
    action: 'copyToLocal',
    actionTitle: 'SOCIAL.USER_EVENT.BTN_COPY_TO_LOCAL',
    actionColor: 'primary',
    fromObject: ObservedLocation.fromObject,
    childrenFields: ['landings']
  }
}*/


@Component({
  selector: 'app-user-events-table',
  styleUrls: ['user-events.table.scss'],
  templateUrl: './user-events.table.html',
  changeDetection: ChangeDetectionStrategy.OnPush
  })
export class UserEventsTable extends AppTable<UserEvent, UserEventFilter>
  implements OnInit {

  dateTimePattern: string;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;

  @Input() recipient: string;

  @Input() withContent: boolean;
  @Input() defaultSortBy: string;
  @Input() defaultSortDirection: SortDirection;

  constructor(
    protected injector: Injector,
    protected accountService: AccountService,
    protected service: UserEventService,
    protected entities: EntitiesStorage,
    protected cd: ChangeDetectorRef,
    @Inject(ENVIRONMENT) protected environment
  ) {
    super(injector.get(ActivatedRoute),
      injector.get(Router),
      injector.get(Platform),
      injector.get(Location),
      injector.get(ModalController),
      injector.get(LocalSettingsService),
      // columns
      RESERVED_START_COLUMNS
        .concat([
          'creationDate',
          'icon',
          'eventType',
          'message'
        ])
        .concat(RESERVED_END_COLUMNS),
      null,
      null,
      injector);

    this.i18nColumnPrefix = 'SOCIAL.USER_EVENT.';
    this.autoLoad = false; // this.start()
    this.inlineEdition = false;
    this.defaultSortBy = 'creationDate';
    this.defaultSortDirection = 'desc';

  }

  ngOnInit() {
    super.ngOnInit();

    // Load date/time pattern
    this.dateTimePattern = this.translate.instant('COMMON.DATE_TIME_PATTERN');
    this.withContent = toBoolean(this.withContent, false);

    const account = this.accountService.account;
    const pubkey = account && account.pubkey;
    this.isAdmin = this.accountService.isAdmin();
    this.canEdit = this.isAdmin || pubkey === this.recipient;
    this.canDelete = this.canEdit;

    this.setDatasource(new EntitiesTableDataSource(UserEvent,
      this.service,
      null,
      {
        prependNewElements: false,
        suppressErrors: true,
        dataServiceOptions: {
          withContent: this.withContent
        }
      }));

    const filter = this.filter || new UserEventFilter();
    filter.recipient = this.recipient;
    this.setFilter(filter, {emitEvent: true});
  }

  async start() {
    console.debug('[user-event] Starting...');

    // Waiting account to be ready
    await this.accountService.ready();

    // Load data
    this.onRefresh.emit();
  }

  getIcon(source: UserEvent): UserEventIcon {
    return ICONS_MAP[source.eventType];
  }

  getDetail(source: UserEvent): Partial<UserEventDetail<IEntity<any>> & {actions: UserEventAction<any>[]}> {
    if (!source) return undefined;

    if (source.content && source.eventType === UserEventTypes.DEBUG_DATA) {
      const context = source.content.context;
      if (context && context.__typename) {
        const actions = this.service.getActionsByTypename(context.__typename);
        return {
          actions,
          title: source.content.error && source.content.error.message || source.content.message,
          description: source.content.error && source.content.error.details || undefined
        };
      }
    }

    console.debug('TODO: implement getDetail() for event: ', source);
    return {};
  }


  async doAction(action: UserEventAction<any>, row: TableElement<UserEvent>) {

    const event = row.currentData;
    const context = event.content && event.content.context;

    this.markAsLoading();

    if (action && typeof action.executeAction === 'function') {
      try {
        let res = action.executeAction(event, context);
        res = (res instanceof Promise) ? await res : res;
      } catch (err) {
        this.error = err && err.message || err;
        console.error(`[user-event] Failed to execute action ${action.name}: ${err && err.message || err}`, err);
      }
      finally {
        this.markAsLoaded();
      }
    }
  }

}
