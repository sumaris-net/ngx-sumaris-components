import {ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Injector, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AppTable, DEFAULT_PAGE_SIZE, RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from '../table.class';
import {DefaultStatusList, Referential} from '../../services/model/referential.model';
import {ActivatedRoute, Router} from '@angular/router';
import {IonInfiniteScroll, ModalController, Platform} from '@ionic/angular';
import {Location} from '@angular/common';
import {LocalSettingsService} from '../../services/local-settings.service';
import {EntitiesTableDataSource} from '../entities-table-datasource.class';
import {InMemoryEntitiesService} from '../../../shared/services/memory-entity-service.class';
import {AppValidatorService} from '../../services/validator/base.validator.class';
import {AbstractControl, FormBuilder, FormGroup} from '@angular/forms';
import {isNil, isNotNil} from '../../../shared/functions';
import {fromUnixMsTimestamp} from '../../../shared/dates';
import {ReferentialFilter} from '../../services/testing/referential-filter.model';
import {debounceTime, filter, tap} from 'rxjs/operators';
import {MatExpansionPanel} from '@angular/material/expansion';
import Timeout = NodeJS.Timeout;
import {ReferentialValidatorService} from '../../services/testing/referential.validator';
import {StatusIds} from '../../services/model/model.enum';


@Component({
  selector: 'app-table-testing',
  styleUrls: ['table.testing.scss'],
  templateUrl: 'table.testing.html',
  providers: [
    {
      provide: InMemoryEntitiesService,
      useFactory: () => new InMemoryEntitiesService(Referential, ReferentialFilter, {
        sortByReplacement: {id: 'id'}
      })
    },
    {
      provide: AppValidatorService,
      useClass: ReferentialValidatorService
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableTestingPage extends AppTable<Referential, ReferentialFilter>
  implements OnInit, OnDestroy {

  static maxRowCount = 100;

  timer: Timeout;

  canEdit = true;
  data: Referential[];
  filterForm: FormGroup;
  filterCriteriaCount = 0;
  groupColumns = ['top-start', 'group-1', 'group-2', 'top-end'];
  statusList = DefaultStatusList;
  statusById;


  @Input() enableInfiniteScroll: boolean;

  constructor(protected route: ActivatedRoute,
              protected router: Router,
              protected platform: Platform,
              protected location: Location,
              protected modalCtrl: ModalController,
              protected settings: LocalSettingsService,
              protected dataService: InMemoryEntitiesService<Referential, ReferentialFilter>,
              protected validatorService: AppValidatorService,
              protected formBuilder: FormBuilder,
              protected cd: ChangeDetectorRef,
              injector: Injector) {
    super(route, router, platform, location, modalCtrl, settings, [
      ...RESERVED_START_COLUMNS,
      'label',
      'name',
      'statusId',
      'updateDate',
      'comments',
      ...RESERVED_END_COLUMNS
    ],
      new EntitiesTableDataSource(Referential, dataService, validatorService, {
        suppressErrors: false
      }),
      null,
      injector);

    // Works with true and false
    this.enableInfiniteScroll = this.mobile;

    this.autoLoad = false;
    this.inlineEdition = true;
    this.i18nColumnPrefix = 'TABLE.TESTING.';

    this.confirmBeforeDelete = true;
    this.confirmBeforeCancel = false;
    this.undoableDeletion = false;
    this.saveBeforeDelete = false;

    this.saveBeforeSort = true;
    this.saveBeforeFilter = true;
    this.propagateRowError = true;

    // Fill statusById
    this.statusById = {};
    this.statusList.forEach((status) => this.statusById[status.id] = status);

    this.filterForm = formBuilder.group({
      searchText: [null]
    });

    this.onStartEditingRow.subscribe(row => {
      row.validator.patchValue({entityName: 'TestVO'}, {emitEvent: false});
    })
  }

  get hasMoreData(): boolean {
    return this.data.length < 100;
  }

  @ViewChild(MatExpansionPanel, {static: true}) filterExpansionPanel: MatExpansionPanel;
  @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;

  ngOnInit() {
    super.ngOnInit();

    // Update filter when changes
    this.registerSubscription(
      this.filterForm.valueChanges
        .pipe(
          debounceTime(250),
          filter(() => this.filterForm.valid),
          tap(value => {
            const filter = ReferentialFilter.fromObject(value);
            this.filterCriteriaCount = filter.countNotEmptyCriteria();
            this.markForCheck();
            // Applying the filter
            this.setFilter(filter, {emitEvent: false});
          }),
          // Save filter in settings (after a debounce time)
          debounceTime(500),
          tap(json => this.settings.savePageSetting(this.settingsId, json, 'filter'))
        )
        .subscribe()
    );

    this.registerSubscription(
      this.onRefresh.subscribe(() => {
        this.filterForm.markAsUntouched();
        this.filterForm.markAsPristine();
      }));

  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    // Restore filter from settings
    this.restoreFilter();

    // Load data
    this.load();
  }

  ngOnDestroy() {
    console.debug('[test-table] Destroying table...');
    super.ngOnDestroy();
    this.stopTimer();
    this.dataService.ngOnDestroy();
  }

  protected restoreFilter() {
    const json = this.settings.getPageSettings(this.settingsId, 'filter');
    console.debug('[table-test] Restoring filter from settings...', json);

    if (json) {
      const filter = ReferentialFilter.fromObject(json);
      this.filterForm.patchValue(json, {emitEvent: false});
      this.filterCriteriaCount = filter.countNotEmptyCriteria();
      this.setFilter(filter, {emitEvent: false});
      this.markForCheck();
    }
  }

  toggleTimer() {
    if (isNotNil(this.timer)) this.stopTimer();
    else this.startTimer();
  }

  load() {
    console.debug('[test-table] Updating data...');
    this.markAsLoading();

    if (isNil(this.data)) {
      this.data = this.generateData(0, this.enableInfiniteScroll ? this.defaultPageSize : TableTestingPage.maxRowCount);
    }
    this.dataService.setValue(this.data, {emitEvent: false});
    this.onRefresh.emit();

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = !this.infiniteScroll || this.data.length >= TableTestingPage.maxRowCount;
    }
  }

  loadMore(event?: CustomEvent & { target?: EventTarget & { complete?: () => void }}) {
    console.debug('[table-test] Loading more...', event);

    setTimeout(() => {
      this.data = [
        ...this.data,
        ...this.generateData(this.data.length,20)
      ];
      this.dataService.setValue(this.data, {emitEvent: false});

      this.defaultPageSize = this.data.length;
      this.infiniteScroll.disabled = this.data.length >= 100;
      this.doRefresh(event);

    }, 500);
  }

  async save(): Promise<boolean> {
    const saved = await super.save();
    if (saved) {
      // Update source data
      this.data = this.dataService.value;
    }
    return saved;
  }

  clearControlValue(event: UIEvent, formControl: AbstractControl): boolean {
    if (event) event.stopPropagation(); // Avoid to enter input the field
    formControl.setValue(null);
    return false;
  }

  applyFilterAndClosePanel(event?: UIEvent) {
    this.defaultPageSize = DEFAULT_PAGE_SIZE;
    this.onRefresh.emit(event);
    this.filterExpansionPanel.close();
  }

  resetFilter(event?: UIEvent) {
    this.filterForm.reset({}, {emitEvent: true});
    this.setFilter(ReferentialFilter.fromObject({}), {emitEvent: true});
    this.filterExpansionPanel.close();
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.data = null; // Reset
      this.load();
    }, 500);
  }

  stopTimer() {
    if (isNotNil(this.timer)) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected generateData(offset?: number, size?: number, ): Referential[] {
    offset = offset || 0;
    size = size || 100;

    const result = new Array<Referential>();
    for (let i = 0; i < size; i++) {
      const id = i + 1 + offset;
      const item = Referential.fromObject({
        id,
        label: 'CODE-' + id,
        name: 'Name #' + id,
        statusId: StatusIds.ENABLE,
        comments: 'My comment #' + id,
        creationDate: fromUnixMsTimestamp(Date.now() - i * 60 * 1000),
        updateDate: fromUnixMsTimestamp(Date.now() - i * 60 * 1000),
        entityName: 'TestVO'
      });
      result.push(item);
    }

    return result;
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
