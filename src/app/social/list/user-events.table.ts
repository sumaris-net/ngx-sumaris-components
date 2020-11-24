import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, Input, OnDestroy, OnInit} from "@angular/core";
import {TableElement} from "@e-is/ngx-material-table";
import {UserEventFilter, UserEventService, UserEventWatchOptions} from "../services/user-event.service";
import {AccountService} from "../../core/services/account.service";
import {UserEvent, UserEventTypes} from "../services/model/user-event.model";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {toBoolean} from "../../shared/functions";
import {Moment} from "moment";
import {AppTable, RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from "../../core/table/table.class";
import {ActivatedRoute, Router} from "@angular/router";
import {ModalController, Platform} from "@ionic/angular";
import {Location} from "@angular/common";
import {EntitiesTableDataSource} from "../../core/table/entities-table-datasource.class";
import {SortDirection} from "@angular/material/sort";
import {EntitiesStorage} from "../../core/services/storage/entities-storage.service";
import {Trip} from "../../trip/services/model/trip.model";
import {PredefinedColors} from "@ionic/core";
import {IEntity} from "../../core/services/model/entity.model";
import {RootDataEntity, SynchronizationStatusEnum} from "../../data/services/model/root-data-entity.model";


export interface UserEventDetail<T extends IEntity<T>> {
  title: string;
  description?: string;
  path?: string;

  action?: string | any;
  actionTitle?: string;
  actionColor?: PredefinedColors;

  icon?: string;
  matIcon?: string;
  color?: string,
  cssClass?: string;
  time?: Moment;

  // A config property, to override the title
  titleProperty?: string;
  titleArgs?: {[key: string]: string};

  // conversion
  fromObject?: (source: any) => T;
}
export interface UserEventIcon{
  icon?: string;
  matIcon?: string;
  color?: PredefinedColors;
}
const ICONS_MAP: {[key: string]: UserEventIcon } = {
  "DEBUG_DATA": {matIcon: "bug_report"},
  "INBOX_MESSAGE": {matIcon: "mail"},
}
const DETAILS_MAP: {[key: string]: Partial<UserEventDetail<RootDataEntity<any>>>} = {
  "TripVO": {
    icon: null,
    matIcon: "content_copy",
    action: 'copyToLocal',
    actionTitle: 'SOCIAL.USER_EVENT.BTN_COPY_TO_LOCAL',
    actionColor: 'primary',
    fromObject: Trip.fromObject
  }
}


@Component({
  selector: 'app-user-events-table',
  styleUrls: ['user-events.table.scss'],
  templateUrl: './user-events.table.html',
  changeDetection: ChangeDetectionStrategy.OnPush
  })
export class UserEventsTable extends AppTable<UserEvent, UserEventWatchOptions>
  implements OnInit, OnDestroy {

  dateTimePattern: string;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;

  @Input() recipient: string;

  @Input() withContent: boolean;
  @Input() sortBy: string;
  @Input() sortDirection: SortDirection;

  constructor(
    protected injector: Injector,
    protected accountService: AccountService,
    protected service: UserEventService,
    protected entities: EntitiesStorage,
    protected cd: ChangeDetectorRef
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
    this.sortBy = 'creationDate';
    this.sortDirection = 'desc';

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

    this.setDatasource(new EntitiesTableDataSource<UserEvent, UserEventFilter>(UserEvent,
      this.service,
      null,
      {
        prependNewElements: false,
        suppressErrors: true,
        dataServiceOptions: {
          withContent: this.withContent
        }
      }));

    this.setFilter({
      ...this.filter,
      recipient: this.recipient
    }, {emitEvent: true});
  }

  ngOnDestroy() {
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

  getDetail(source: UserEvent): Partial<UserEventDetail<IEntity<any>>> {
    if (!source) return undefined;


    if (source.content && source.eventType === UserEventTypes.DEBUG_DATA) {
      const context = source.content.context;
      if (context && context.__typename) {
        return {
          ...DETAILS_MAP[context.__typename],
          title: source.content.error && source.content.error.message || source.content.message,
          description: source.content.error && source.content.error.details || undefined
        };
      }
    }

    console.debug('TODO: implement getDetail() for event: ', source);
    return {};
  }


  async doAction(action: string, row: TableElement<UserEvent>) {

    const data = row.currentData;
    const context = data.content && data.content.context;
    const details = context && DETAILS_MAP[context.__typename];

    if (action === 'copyToLocal' && details.fromObject) {

      console.debug("[user-events] Copy debug data locally...", context);

      // Convert to entity, then to JSON (without local id)
      const entity = details.fromObject(context);
      entity.id = null;
      entity.synchronizationStatus = SynchronizationStatusEnum.DIRTY;
      const json = entity.asObject({minify: false,
        keepTypename: true,
        keepEntityName: true,
        keepLocalId: false, // Clean local ID
        keepSynchronizationStatus: true});

      // Save to entities storage
      await this.entities.save(json);

      // Alert user
      await this.showToast({message: 'SOCIAL.USER_EVENT.INFO.COPIED_LOCALLY'});
    }
  }

}