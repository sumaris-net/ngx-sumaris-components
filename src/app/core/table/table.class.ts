import {AfterViewInit, Directive, EventEmitter, Injector, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort, MatSortable, SortDirection} from '@angular/material/sort';
import {MatTable} from '@angular/material/table';
import {BehaviorSubject, combineLatest, EMPTY, merge, Observable, of, Subject, Subscription} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, filter, first, map, mergeMap, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';
import {TableElement} from '@e-is/ngx-material-table';
import {EntitiesTableDataSource} from './entities-table-datasource.class';
import {SelectionModel} from '@angular/cdk/collections';
import {IEntity} from '../services/model/entity.model';
import {AlertController, ModalController, Platform, ToastController} from '@ionic/angular';
import {ActivatedRoute, Router} from '@angular/router';
import {ColumnItem, TableSelectColumnsComponent} from './table-select-columns.component';
import {Location} from '@angular/common';
import {ErrorCodes} from '../services/errors';
import {AppFormUtils, IAppForm} from '../form/form.utils';
import {LocalSettingsService} from '../services/local-settings.service';
import {TranslateService} from '@ngx-translate/core';
import {PlatformService} from '../services/platform.service';
import {MatAutocompleteConfigHolder, MatAutocompleteFieldAddOptions, MatAutocompleteFieldConfig} from '../../shared/material/autocomplete/material.autocomplete';
import {CompletableEvent, createPromiseEventEmitter, emitPromiseEvent} from '../../shared/events';
import {changeCaseToUnderscore, isEmptyArray, isNil, isNotNil, toBoolean} from '../../shared/functions';
import {firstFalsePromise} from '../../shared/observables';
import {ShowToastOptions, Toasts} from '../../shared/toasts';
import {Alerts} from '../../shared/alerts';
import {SharedValidators} from '../../shared/validator/validators';
import {CdkColumnDef} from '@angular/cdk/table';

export const SETTINGS_DISPLAY_COLUMNS = 'displayColumns';
export const SETTINGS_SORTED_COLUMN = 'sortedColumn';
export const SETTINGS_FILTER = 'filter';
export const SETTINGS_PAGE_SIZE = 'pageSize';
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500];
export const RESERVED_START_COLUMNS = ['select', 'id'];
export const RESERVED_END_COLUMNS = ['actions'];
export const DEFAULT_REQUIRED_COLUMNS = ['id'];

export class CellValueChangeListener {
  subject: Subject<any>;
  subscription: Subscription; // The row start editing subscription
  formPath: string;
  emitInitialValue: boolean;
}


export interface IModalDetailOptions<T = any> {
  // Data
  isNew: boolean;
  data: T;
  disabled: boolean;

  // Callback functions
  onDelete: (event: UIEvent, data: T) => Promise<boolean>;
}

export type SaveActionType = 'delete' | 'sort' | 'filter';

// @dynamic
@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class AppTable<
  T extends IEntity<T, ID>,
  F = any,
  ID = number
  >
  implements OnInit, OnDestroy, AfterViewInit, IAppForm {

  private _initialized = false;
  private _subscription = new Subscription();
  private _dataSourceloadingSubscription: Subscription;

  private _cellValueChangesDefs: {
    [key: string]: CellValueChangeListener;
  } = {};

  protected _enabled = true;
  protected _destroy$ = new Subject();
  protected _autocompleteConfigHolder: MatAutocompleteConfigHolder;
  protected allowRowDetail = true;
  protected translate: TranslateService;
  protected alertCtrl: AlertController;
  protected toastController: ToastController;
  protected _focusColumn: string;

  excludesColumns: string[] = [];
  displayedColumns: string[];
  totalRowCount: number|null = null;
  visibleRowCount: number;

  loadingSubject = new BehaviorSubject<boolean>(true);
  savingSubject = new BehaviorSubject<boolean>(false);
  dirtySubject = new BehaviorSubject<boolean>(false);
  errorSubject = new BehaviorSubject<string>(undefined);

  get error(): string {
    return this.errorSubject.value;
  }

  get error$(): Observable<string> {
    return this.errorSubject.asObservable();
  }

  /**
   * @deprecated
   * @param error
   */
  set error(error: string) {
    this.setError(error);
  }

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  get saving$(): Observable<boolean> {
    return this.savingSubject.asObservable();
  }

  isRateLimitReached = false;
  selection = new SelectionModel<TableElement<T>>(true, []);
  editedRow: TableElement<T> = undefined;
  settingsId: string;
  autocompleteFields: {[key: string]: MatAutocompleteFieldConfig};
  mobile: boolean;

  // Table options
  @Input() debug: boolean;
  @Input() i18nColumnPrefix = 'COMMON.';
  @Input() i18nColumnSuffix: string;
  @Input() autoLoad = true;
  @Input() readOnly: boolean;
  @Input() inlineEdition: boolean;
  @Input() focusFirstColumn = false;
  @Input() confirmBeforeDelete = false;
  @Input() confirmBeforeCancel = false;
  @Input() undoableDeletion = false;
  @Input() saveBeforeDelete: boolean;
  @Input() keepEditedRowOnSave: boolean;
  @Input() saveBeforeSort: boolean;
  @Input() saveBeforeFilter: boolean;
  @Input() propagateRowError = false;

  @Input() defaultSortBy: string;
  @Input() defaultSortDirection: SortDirection;
  @Input() defaultPageSize = DEFAULT_PAGE_SIZE;
  @Input() defaultPageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS;

  // Focus manager
  @Input() set focusColumn(name) {
    this._focusColumn = name;
  }

  get focusColumn(): string {
    return this._focusColumn ;
  }

  get firstUserColumn(): string {
    return this.displayedColumns[RESERVED_START_COLUMNS.length];
  }

  get lastUserColumn(): string {
    return this.displayedColumns[this.displayedColumns.length - RESERVED_END_COLUMNS.length - 1];
  }

  @Input() set dataSource(value: EntitiesTableDataSource<T, F, ID>) {
    this.setDatasource(value);
  }

  get dataSource(): EntitiesTableDataSource<T, F, ID> {
    return this._dataSource;
  }

  @Input() set filter(value: F) {
    this.setFilter(value);
  }

  get filter(): F {
    return this._filter;
  }

  get empty(): boolean {
    return this.loading || this.totalRowCount === 0;
  }

  @Output() onRefresh = new EventEmitter<any>();
  @Output() onOpenRow = new EventEmitter<{ id?: ID; row: TableElement<T> }>();
  @Output() onNewRow = new EventEmitter<any>();
  @Output() onStartEditingRow = new EventEmitter<TableElement<T>>();
  @Output() onConfirmEditCreateRow = new EventEmitter<TableElement<T>>();
  @Output() onCancelOrDeleteRow = new EventEmitter<TableElement<T>>();
  @Output() onBeforeDeleteRows = createPromiseEventEmitter<boolean, {rows: TableElement<T>[]}>();
  @Output() onBeforeCancelRows = createPromiseEventEmitter<boolean, {rows: TableElement<T>[]}>();
  @Output() onBeforeSave = createPromiseEventEmitter<{confirmed: boolean; save: boolean}, {action: SaveActionType; valid: boolean}>();
  @Output() onAfterDeletedRows = new EventEmitter<TableElement<T>[]>();
  @Output() onSort = new EventEmitter<any>();
  @Output() onDirty = new EventEmitter<boolean>();
  @Output() onError = new EventEmitter<string>();

  get dirty(): boolean {
    return this.dirtySubject.value;
  }

  get valid(): boolean {
    return this.editedRow && this.editedRow.editing ? this.editedRow.validator?.valid : true;
  }

  get invalid(): boolean {
    return this.editedRow && this.editedRow.editing ? this.editedRow.validator?.invalid : false;
  }

  get pending(): boolean {
    return this.editedRow && this.editedRow.editing ? this.editedRow.validator?.pending : false;
  }

  disable(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.sort) this.sort.disabled = true;
    this._enabled = false;
  }

  enable(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.sort) this.sort.disabled = false;
    this._enabled = true;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // FIXME: need to hidden buttons (in HTML), etc. when disabled
  @Input() set disabled(disabled: boolean) {
    if (disabled !== !this._enabled) {
      if (disabled) this.disable({emitEvent: false});
      else this.enable({emitEvent: false});
    }
  }

  get disabled(): boolean {
    return !this._enabled;
  }

  markAsDirty(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.dirtySubject.value !== true) {
      this.dirtySubject.next(true);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsPristine(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.dirtySubject.value !== false) {
      this.dirtySubject.next(false);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsUntouched(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.dirtySubject.value !== false || this.editedRow) {
      this.dirtySubject.next(false);
      this.editedRow = null;
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsTouched(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    if (this.editedRow && this.editedRow.editing) {
      this.editedRow.validator.markAllAsTouched();
      //AppFormUtils.markAsTouched(this.editedRow.validator, opts);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsSaving(opts?: { emitEvent?: boolean }) {
    if (this.savingSubject.value !== true) {
      this.savingSubject.next(true);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsSaved(opts?: { emitEvent?: boolean }) {
    if (this.savingSubject.value !== false) {
      this.savingSubject.next(false);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  markAsLoading(opts?: {emitEvent?: boolean}) {
    this.setLoading(true, opts);
  }

  markAsLoaded(opts?: {emitEvent?: boolean}) {
    this.setLoading(false, opts);
  }

  protected markRowAsDirty(row?: TableElement<T>, opts?: { onlySelf?: boolean; emitEVent?: boolean; }) {
    row = row || this.editedRow;
    if (row) row.validator?.markAsDirty(opts);
    this.markAsDirty(opts);
  }

  get loading(): boolean {
    return this.loadingSubject.getValue();
  }

  get loaded(): boolean {
    return !this.loadingSubject.getValue();
  }

  enableSort() {
    if (this.sort) this.sort.disabled = false;
  }

  disableSort() {
    if (this.sort) this.sort.disabled = true;
  }

  set pageSize(value: number) {
    this.defaultPageSize = value;
    if (this.paginator) {
      this.paginator.pageSize = value;
    }
  }

  get pageSize(): number {
    return this.paginator && this.paginator.pageSize || this.defaultPageSize || DEFAULT_PAGE_SIZE;
  }

  get pageOffset(): number {
    return this.paginator && this.paginator.pageIndex * this.paginator.pageSize || 0;
  }

  get sortActive(): string {
    return this.sort && this.sort.active;
  }
  get sortDirection(): 'asc' | 'desc' {
    return this.sort && this.sort.direction && (this.sort.direction === 'desc' ? 'desc' : 'asc') || undefined;
  }

  private _paginator: MatPaginator|null = null;

  @Input() set paginator(value: MatPaginator) {
    this._paginator = value;
  }

  get paginator(): MatPaginator {
    return this._paginator || this.childPaginator;
  }

  @ViewChild(MatTable, {static: false}) table: MatTable<T>;
  @ViewChild(MatPaginator, {static: false}) childPaginator: MatPaginator;
  @ViewChild(MatSort, {static: false}) sort: MatSort;

  protected constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: Platform | PlatformService,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected settings: LocalSettingsService,
    protected columns: string[],
    protected _dataSource?: EntitiesTableDataSource<T, F, ID>,
    private _filter?: F,
    injector?: Injector
  ) {
    this.mobile = this.platform.is('mobile');
    this.translate = injector && injector.get(TranslateService);
    this.alertCtrl = injector && injector.get(AlertController);
    this.toastController = injector && injector.get(ToastController);
    this._autocompleteConfigHolder = new MatAutocompleteConfigHolder({
      getUserAttributes: (a, b) => settings.getFieldDisplayAttributes(a, b)
    });
    this.autocompleteFields = this._autocompleteConfigHolder.fields;

  }

  ngOnInit() {
    if (this._initialized) return; // Init only once
    this._initialized = true;

    // Set defaults
    this.readOnly = toBoolean(this.readOnly, false); // read/write by default
    this.inlineEdition = !this.readOnly && toBoolean(this.inlineEdition, false); // force to false when readonly
    this.saveBeforeDelete = toBoolean(this.saveBeforeDelete, !this.readOnly); // force to false when readonly
    this.saveBeforeSort = toBoolean(this.saveBeforeSort, !this.readOnly); // force to false when readonly
    this.saveBeforeFilter = toBoolean(this.saveBeforeFilter, !this.readOnly); // force to false when readonly
    this.keepEditedRowOnSave = toBoolean(this.keepEditedRowOnSave, this.inlineEdition);

    // Check ask user confirmation is possible
    if (this.confirmBeforeDelete && !this.alertCtrl) throw Error('Missing \'alertCtrl\' or \'injector\' in component\'s constructor.');

    // Defined unique id for settings for the page
    this.settingsId = this.settingsId || this.generateTableId();

    this.displayedColumns = this.getDisplayColumns();

    // Load the sorted columns, from settings
    {
      const sortedColumn = this.getSortedColumn();
      this.defaultSortBy = sortedColumn.id;
      this.defaultSortDirection = sortedColumn.start;
    }

    this.defaultPageSize = this.getPageSize();

    // Propagate error to event emitter
    this.registerSubscription(this.errorSubject
      .subscribe(value => this.onError.emit(value)));

    // Propagate dirty to event emitter
    this.registerSubscription(this.dirtySubject
      .subscribe(value => this.onDirty.emit(value)));

    // Propagate row dirty state to table
    this.registerSubscription(
      this.onStartEditingRow
        .pipe(
          filter(row => row.validator && true),
          mergeMap(row => row.validator.valueChanges
            .pipe(
              takeUntil(
                // Stop if next another row, or destroying
                combineLatest([
                  this.onStartEditingRow,
                  this._destroy$
                ])
              ),
              map(() => row.validator?.dirty),
              filter(dirty => dirty === true),
              first(),
              // DEBUG
              //tap(() => console.debug("Propagate row's dirty to table..."))
            ))
        )
        .subscribe(() => this.markAsDirty())
    );

    // Call datasource refresh, on each refresh events
    this.registerSubscription(
      this.onRefresh
        .pipe(
          startWith<any, any>(this.autoLoad ? {} : 'skip'),
          switchMap(
            (event: any) => {
              this.dirtySubject.next(false);
              this.selection.clear();
              this.editedRow = undefined;
              if (event === 'skip') {
                return of(undefined);
              }
              if (!this._dataSource) {
                if (this.debug) console.debug('[table] Skipping data load: no dataSource defined');
                return of(undefined);
              }
              if (this.debug) console.debug('[table] Calling dataSource.watchAll()...');
              return this._dataSource.watchAll(
                this.pageOffset,
                this.pageSize,
                this.sortActive,
                this.sortDirection,
                this._filter
              );
            }),
          catchError(err => {
            this.error = err && err.message || err;
            if (this.debug) console.error(err);
            return of(undefined);
          })
        )
        .subscribe(res => {
          if (!res) return; // Skip
          if (res && res.data) {
            this.isRateLimitReached = !this.paginator || (res.data.length < this.paginator.pageSize);
            this.visibleRowCount = res.data.length;
            this.totalRowCount = isNotNil(res.total) ? res.total : ((this.paginator && this.paginator.pageIndex * (this.paginator.pageSize || DEFAULT_PAGE_SIZE) || 0) + this.visibleRowCount);
            if (this.debug) console.debug(`[table] ${res.data.length} rows loaded`);
          } else {
            //if (this.debug) console.debug('[table] NO rows loaded');
            this.isRateLimitReached = true;
            this.totalRowCount = 0;
            this.visibleRowCount = 0;
          }
          this.markAsUntouched({emitEvent: false});
          this.markAsPristine({emitEvent: false});
          this.markAsLoaded({emitEvent: false});
          this.markForCheck();
        }));

    // Listen dataSource events
    if (this._dataSource) this.listenDatasourceLoading(this._dataSource);
  }

  ngAfterViewInit() {
    if (this.debug) {
      // Warn if table not exists
      if (!this.table) {
        setTimeout(() => {
          if (!this.table) {
            console.warn(`[table] Missing <mat-table> in the HTML template (after waiting 500ms)! Component: ${this.constructor.name}`);
          }
        }, 500);
      }

      if (!this.displayedColumns) console.warn(`[table] Missing 'displayedColumns'. Did you call super.ngOnInit() in component ${this.constructor.name} ?`);
    }

    merge(
      // Listen sort events
      this.sort && this.sort.sortChange
        .pipe(
          mergeMap(async () => this.saveBeforeAction('sort')),
          filter(res => res === true),
          // Save sort in settings
          tap(() => {
            const value = [this.sort.active, this.sort.direction || 'asc'].join(':');
            this.settings.savePageSetting(this.settingsId, value, SETTINGS_SORTED_COLUMN);
          })
        )
      || EMPTY,

      // Listen paginator events
      this.paginator && this.paginator.page
        .pipe(
          mergeMap(async () => this.saveBeforeAction('sort')),
          filter(res => res === true),
          // Save page size
          tap(() => this.settings.savePageSetting(this.settingsId, this.paginator.pageSize, SETTINGS_PAGE_SIZE))
        ) || EMPTY
    ).subscribe(value => {
      this.onSort.emit();
      this.onRefresh.emit(value);
    });

    // If the user changes the sort order, reset back to the first page.
    if (this.sort && this.paginator) {
      this.registerSubscription(
        this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0)
      );
    }
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();

    // Unsubscribe column value changes
    Object.keys(this._cellValueChangesDefs).forEach(col => this.stopCellValueChanges(col, true));
    this._cellValueChangesDefs = {};

    this.loadingSubject.unsubscribe();
    this.savingSubject.unsubscribe();
    this.errorSubject.unsubscribe();
    this.dirtySubject.unsubscribe();

    this.onRefresh.unsubscribe();
    this.onOpenRow.unsubscribe();
    this.onNewRow.unsubscribe();
    this.onStartEditingRow.unsubscribe();
    this.onConfirmEditCreateRow.unsubscribe();
    this.onCancelOrDeleteRow.unsubscribe();
    this.onBeforeDeleteRows.unsubscribe();
    this.onBeforeCancelRows.unsubscribe();
    this.onBeforeSave.unsubscribe();
    this.onAfterDeletedRows.unsubscribe();
    this.onSort.unsubscribe();
    this.onDirty.unsubscribe();
    this.onError.unsubscribe();

    this._destroy$.next();
    this._destroy$.unsubscribe();

    if (this._dataSource) {
      this._dataSource.ngOnDestroy();
    }
  }

  setDatasource(datasource: EntitiesTableDataSource<T, F, ID>) {
    if (this._dataSource) throw new Error('[table] dataSource already set !');
    if (datasource && this._dataSource !== datasource) {
      this._dataSource = datasource;
      if (this._initialized) this.listenDatasourceLoading(datasource);
    }
  }

  resetDataSource() {
    if (this._dataSourceloadingSubscription) {
      this._dataSourceloadingSubscription.unsubscribe();
      this._subscription.remove(this._dataSourceloadingSubscription);
    }
    this._dataSource?.ngOnDestroy();
    this._dataSource = null;
  }

  addColumnDef(column: CdkColumnDef) {
    this.table.addColumnDef(column);
  }

  removeColumnDef(column: CdkColumnDef) {
    this.table.removeColumnDef(column);
  }

  setFilter(filter: F, opts?: { emitEvent: boolean }) {
    opts = opts || {emitEvent: true};

    if (this.saveBeforeFilter) {

      // if a dirty table is to be saved before filter
      if (this.dirty) {

        // Save
        this.saveBeforeAction('filter').then(saved => {
          // Apply filter only if user didn't cancel the save or the save is ok
          if (saved) {
            this.applyFilter(filter, opts);
          }
        });

      } else {
        // apply filter on non dirty table
        this.applyFilter(filter, opts);
      }

    } else {

      // apply filter directly
      this.applyFilter(filter, opts);
    }
  }

  confirmAndAdd(event?: UIEvent, row?: TableElement<T>): boolean {
    if (!this.confirmEditCreate(event, row)) {
      return false;
    }
    // Add row
    return this.addRow(event);
  }

  confirmAndBackward(event?: UIEvent, row?: TableElement<T>): boolean {

    // Deleting edited row, if empty and not dirty
    const previousRow = this.editedRow;
    if (previousRow && (previousRow.id === -1) && previousRow.validator?.invalid && !(previousRow.validator?.dirty)) {
      this.deleteNewRow(event, previousRow);

      // Wait deletion is done, then edit previous row (by id, because of reloading)
      firstFalsePromise(this.loadingSubject)
        .then(() => this.editRowById(event, row.id, {focusColumn: this.lastUserColumn}));
      return true;
    }

    // Edit next row
    this.editRow(event, row, {focusColumn: this.lastUserColumn});
    return true;
  }

  confirmAndForward(event?: UIEvent, row?: TableElement<T>): boolean {
    row = row || this.editedRow;
    if (!this.confirmEditCreate(event, row)) {
      return false;
    }
    // Edit next row
    this.editRowById(event, row.id + 1, {focusColumn: this.firstUserColumn});
    return true;
  }

  async editRowById(event: UIEvent|undefined, id: number, opts?: {focusColumn?: string; }) {
    if (id < 0) return;
    if (id >= this.visibleRowCount) {
      this.focusColumn = opts && opts.focusColumn || this.firstUserColumn;
      this.addRow(event);
    }
    else {
      const row = await this.dataSource.getRow(id);
      this.editRow(event, row, opts);
    }
  }

  /**
   * Confirm the creation of the given row, or if not specified the currently edited row
   *
   * @param event
   * @param row
   */
  confirmEditCreate(event?: Event, row?: TableElement<T>): boolean {
    row = row || this.editedRow;
    if (!row || !row.editing) return true; // no row to confirm

    // Stop event
    event?.stopPropagation();

    // Confirmation edition or creation
    const confirmed = row.confirmEditCreate();

    if (confirmed) {
      // If edit finished, forget edited row
      if (row === this.editedRow) {
        this.editedRow = undefined;
      }

      // Mark table as dirty (if row is dirty)
      if (row.validator?.dirty) {
        this.markAsDirty({emitEvent: false /* because of resetError() */});
      }

      // Clear error
      this.resetError();

      // Emit the confirm event
      this.onConfirmEditCreateRow.next(row);

      return true; // Continue
    }

    if (row.validator) {
      // If pending: Wait end of validation, then loop
      if (row.validator.pending) {
        AppFormUtils.waitWhilePending(row.validator).then(() => this.confirmEditCreate(event, row));
        return false;
      }

      // NOT confirmed = row has error
      if (this.debug) {
        console.warn('[table] Cannot confirm row, because invalid');
        AppFormUtils.logFormErrors(row.validator, '[table] ');
      }

      // fix: mark all controls as touched to show errors
      row.validator.markAllAsTouched();

      // Compute row error, and propagate to table's error
      if (this.propagateRowError) {
        const error = this.getRowError(row);
        this.setError(error);
      }
    }

    return false;
  }

  cancelOrDelete(event: Event, row: TableElement<T>, opts?: { interactive?: boolean; }) {
    if (row.id === -1) {
      this.deleteNewRow(event, row);
    } else {
      this.cancelOrDeleteExistingRow(event, row, opts);
    }
  }

  addRow(event?: Event, insertAt?: number): boolean {
    if (this.debug) console.debug('[table] Asking for new row...');
    if (!this._enabled) return false;

    // Use modal if inline edition is disabled
    if (!this.inlineEdition) {
      this.openNewRowDetail(event);
      return false;
    }

    // Try to finish edited row first
    if (!this.confirmEditCreate()) {
      return false;
    }

    // Add new row
    this.addRowToTable(insertAt);
    return true;
  }

  async save(): Promise<boolean> {
    if (this.readOnly) {
      throw {code: ErrorCodes.TABLE_READ_ONLY, message: 'ERROR.TABLE_READ_ONLY'};
    }

    this.resetError();

    if (!this.confirmEditCreate()) {
      throw {code: ErrorCodes.TABLE_INVALID_ROW_ERROR, message: 'ERROR.TABLE_INVALID_ROW_ERROR'};
    }

    // Keep edited row id
    const editedRowId = this.keepEditedRowOnSave && this.editedRow?.id;

    try {
      // Mark as saving
      this.markAsSaving();

      // Calling service save()
      if (this.debug) console.debug('[table] Calling dataSource.save()...');
      const isOK = await this._dataSource.save();

      if (isOK) this.markAsPristine();

      return isOK;
    } catch (err) {
      if (this.debug) console.debug('[table] dataSource.save() return an error:', err);
      this.setError(err && err.message || err);
      this.markForCheck();
      throw err;
    }
    finally {
      this.markAsSaved();

      // Restoring previous row
      if (isNotNil(editedRowId)) {
        if (editedRowId !== -1) {
          this.dataSource.waitIdle()
            .then(() => this.dataSource.getRow(editedRowId))
            // Select by row id
            .then(row => row && this.clickRow(null, row))
        } else {
          // TODO: find a way to restore the row (find it by data ?)
        }
      }
    }
  }

  cancel(event?: UIEvent, opts?: { interactive?: boolean; }) {

    // Check confirmation
    if ((!opts || opts.interactive !== false) && this.dirty && (this.confirmBeforeCancel || this.onBeforeCancelRows.observers.length > 0)) {
      event?.stopPropagation();
      this.canCancelRows().then(confirm => {
        // If confirmed, loop
        if (confirm) this.cancel(null, {interactive: false});
      });
      return;
    }

    this.onRefresh.emit();
  }

  async duplicateRow(event?: Event, row?: TableElement<T>) {
    event?.stopPropagation();

    row = row || this.singleSelectedRow;
    if (!row || !this.confirmEditCreate(event, row)) {
      return false;
    }

    const newRow = await this.addRowToTable(row.id + 1);
    const json = {...row.currentData, id: null};

    if (newRow.validator) {
      newRow.validator.patchValue(json);
      newRow.validator.markAsDirty();
    }
    else {
      if (newRow.currentData?.fromObject) {
        newRow.currentData.fromObject(json);
      }
      else {
        newRow.currentData = json;
      }
      this.markAsDirty();
    }

    // select
    this.clickRow(undefined, newRow);
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    // DEBUG
    //console.debug('isAllSelected. lengths', this.selection.selected.length, this.totalRowCount);

    return this.selection.selected.length === this.totalRowCount ||
      this.selection.selected.length === this.visibleRowCount;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  async masterToggle() {

    if (this.loading) return;
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      const rows = await this._dataSource.getRows();
      rows.forEach(row => this.selection.select(row));
    }
  }

  deleteSelection(event: UIEvent): Promise<number> {
    return this.deleteRows(event, this.selection.selected);
  }

  /**
   *
   * @param event
   * @param row
   * @param opts Use interactive=false to avoid user interaction (e.g. user confirmation)
   */
  async deleteRow(event: UIEvent|null, row: TableElement<T>, opts?: {interactive?: boolean;}): Promise<boolean> {
    const deleteCount = await this.deleteRows(event, [row], opts);
    return deleteCount === 1;
  }

  /**
   *
   * @param event
   * @param rows
   * @param opts Use interactive=false to avoid user interaction (e.g. user confirmation)
   */
  async deleteRows(event: UIEvent|null, rows: TableElement<T>[], opts?: {interactive?: boolean;}): Promise<number> {
    if (this.readOnly) {
      throw {code: ErrorCodes.TABLE_READ_ONLY, message: 'ERROR.TABLE_READ_ONLY'};
    }
    if (event?.defaultPrevented) return 0; // SKip
    event?.preventDefault();

    if (!this._enabled) return 0;
    if (this.loading || isEmptyArray(rows)) return 0;

    // Check if can delete
    const canDelete = await this.canDeleteRows(rows, opts);
    if (!canDelete) return 0; // Cannot delete

    // If data need to be saved first: do it
    const saved = await this.saveBeforeAction('delete');
    if (!saved) {
      // Stop if save cancelled or save failed
      return;
    }

    if (this.debug) console.debug('[table] Delete selection...');

    const rowsToDelete = rows.slice()
      // Reverse row order
      // This is a workaround, need because row.delete() has async execution
      // and index cache is updated with a delay)
      .sort((a, b) => a.id > b.id ? -1 : 1);

    try {
      const deleteCount = rowsToDelete.length;
      await this._dataSource.deleteAll(rowsToDelete);

      // Not need to update manually, because watchALl().subscribe() will update this count
      //this.totalRowCount -= deleteCount;
      //this.visibleRowCount -= deleteCount;
      this.selection.clear();
      this.editedRow = undefined;
      this.markAsDirty({emitEvent: false /*markForCheck() is called just after*/});
      this.markForCheck();
      this.onAfterDeletedRows.next(rowsToDelete);
      return deleteCount;
    } catch (err) {
      this.error = err && err.message || err;
      return 0;
    }
  }

  protected editRow(event: UIEvent|undefined, row: TableElement<T>, opts?: {focusColumn?: string}): boolean {

    if (!this._enabled) return false;
    if (this.editedRow === row) return true; // Already the edited row
    if (event?.defaultPrevented) return false;

    if (!this.confirmEditCreate()) {
      return false;
    }

    if (!row.editing && !this.loading) {
      this._focusColumn = opts && opts.focusColumn || this._focusColumn;
      this._dataSource.startEdit(row);
    }
    this.editedRow = row;
    this.onStartEditingRow.emit(row);
    return true;
  }

  clickRow(event: UIEvent|undefined, row: TableElement<T>): boolean {
    if (this.loading) {
      // Wait while loading, and loop
      if (this.debug) console.debug("[table] Waiting before apply clickRow() (datasource is busy)...");
      this.dataSource?.waitIdle().then(() => this.clickRow(event, row));
      return false;
    }

    // DEBUG
    console.debug("[table] Detect click on row");

    if (row.id === -1 || row.editing) return true; // Already in edition
    if (event?.defaultPrevented) return false; // Cancelled by event
    if (this.loading) return false; // Already busy

    // Open the detail page (if not inline editing)
    if (!this.inlineEdition) {
      if (this.dirty && this.debug) {
        console.warn('[table] Opening row details, but table has unsaved changes!');
      }

      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }

      // No ID defined: unable to open details
      if (isNil(row.currentData.id)) {
        console.warn('[table] Opening row details, but missing currentData.id!');
        //return false;
      }

      this.markAsLoading();
      this.openRow(row.currentData.id, row)
        .then(() => this.markAsLoaded());

      return true;
    }

    // Start editing row
    return this.editRow(event, row, {focusColumn: undefined /*force to use the click target*/});
  }

  moveRow(id: number, direction: number) {
    this.dataSource.move(id, direction);
  }

  async openSelectColumnsModal(event?: UIEvent): Promise<any> {

    // Copy current columns (deep copy)
    const columns = this.getCurrentColumns();

    const modal = await this.modalCtrl.create({
      component: TableSelectColumnsComponent,
      componentProps: {columns}
    });

    // Open the modal
    await modal.present();

    // On dismiss
    const {data} = await modal.onDidDismiss();
    if (!data) return; // CANCELLED

    // Apply columns
    const userColumns = (data || []).filter(c => c.canHide === false || c.visible).map(c => c.name) || [];
    this.displayedColumns = RESERVED_START_COLUMNS.concat(userColumns).concat(RESERVED_END_COLUMNS);
    this.markForCheck();

    // Update user settings
    await this.settings.savePageSetting(this.settingsId, userColumns, SETTINGS_DISPLAY_COLUMNS);
  }

  trackByFn(index: number, row: TableElement<T>) {
    return row.id;
  }

  doRefresh(event?: CompletableEvent) {
    this.onRefresh.emit(event);

    // When target wait for a complete (e.g. IonRefresher)
    if (event?.target && event.target.complete) {
      setTimeout(async () => {
        await firstFalsePromise(this.loadingSubject);
        event.target.complete();
      });
    }
  }

  getCurrentColumns(): ColumnItem[] {
    const hiddenColumns = this.columns.slice(RESERVED_START_COLUMNS.length)
        .filter(name => this.displayedColumns.indexOf(name) === -1);
    return this.displayedColumns
        .concat(hiddenColumns)
        .filter(name => !RESERVED_START_COLUMNS.includes(name) && !RESERVED_END_COLUMNS.includes(name)
            && !this.excludesColumns.includes(name))
        .map(name => ({
          name,
          label: this.getI18nColumnName(name),
          visible: this.displayedColumns.indexOf(name) !== -1,
          canHide: this.getRequiredColumns().indexOf(name) === -1
        }));
  }

  /* -- protected method -- */

  /**
   * return the selected row if unique in selection
   */
  protected get singleSelectedRow(): TableElement<T> {
    return this.selection.selected?.length === 1 ? this.selection.selected[0] : undefined;
  }

  protected async canDeleteRows(rows: TableElement<T>[], opts?: { interactive?: boolean; }): Promise<boolean> {

    // Check using emitter
    if (this.onBeforeDeleteRows.observers.length > 0) {
      try {
        const canDelete = await emitPromiseEvent(this.onBeforeDeleteRows, 'canDelete', {
          detail: {rows}
        });
        if (!canDelete) return false;
      }
      catch (err) {
        if (err === 'CANCELLED') return false; // User cancel
        console.error('Error while checking if can delete rows', err);
        throw err;
      }
    }

    // Ask user confirmation
    if (this.confirmBeforeDelete && (!opts || opts.interactive !== false)) {
      return this.askDeleteConfirmation(null, rows);
    }
    return true;
  }

  protected async canCancelRows(rows?: TableElement<T>[], opts?: { interactive?: boolean; }): Promise<boolean> {

    // Get dirty rows
    rows = rows || (await this.dataSource.getRows()).filter(row => row.validator?.dirty);

    if (isEmptyArray(rows)) return true; // No dirty: OK

    // Check using emitter
    if (this.onBeforeCancelRows.observers.length > 0) {
      try {
        const isCancel = await emitPromiseEvent(this.onBeforeCancelRows, 'canCancel', {
          detail: {rows}
        });
        if (!isCancel) return false;
      }
      catch (err) {
        if (err === 'CANCELLED') return false; // User cancel
        console.error('Error while checking if can cancel rows', err);
        throw err;
      }
    }

    // Ask user confirmation
    if (this.confirmBeforeCancel && (!opts || opts.interactive !== false)) {
      return this.askCancelConfirmation(null, rows);
    }
    return true;
  }

  protected async saveBeforeAction(saveAction: SaveActionType): Promise<boolean> {

    if (!this.dirty) {
      // Continue without save
      return true;
    }

    let save: boolean;
    switch (saveAction) {
      case 'delete':
        save = this.saveBeforeDelete;
        break;
      case 'filter':
        save = this.saveBeforeFilter;
        break;
      case 'sort':
        save = this.saveBeforeSort;
        break;
      default:
        save = true;
    }

    // Default behavior
    let confirmed = true;

    if (save) {
      if (this.onBeforeSave.observers.length > 0) {
        // Ask confirmation
        try {
          const res = await emitPromiseEvent(this.onBeforeSave, 'beforeSave', {
            detail: {action: saveAction, valid: this.valid}
          });
          confirmed = res.confirmed;
          save = res.save;
        }
        catch (err) {
          if (err === 'CANCELLED') return false; // User cancel
          console.error('Error while checking if can delete rows', err);
          throw err;
        }

      }
    }

    if (confirmed) {
      if (save) {
        // User confirmed save
        const saved = await this.save();
        this.markAsDirty(); // Restore dirty flag
        return saved;
      }
      return true; // No save but continue action
    }
    return false; // User cancel the action
  }

  protected async openRow(id: ID, row: TableElement<T>): Promise<boolean> {
    if (!this.allowRowDetail) return false;

    if (this.onOpenRow.observers.length) {
      this.onOpenRow.emit({id, row});
      return true;
    }

    return await this.router.navigate([id], {
      relativeTo: this.route,
      queryParams: {}
    });
  }

  protected async openNewRowDetail(event?: any): Promise<boolean> {
    if (!this.allowRowDetail) return false;

    if (this.onNewRow.observers.length) {
      this.onNewRow.emit(event);
      return true;
    }

    return await this.router.navigate(['new'], {
      relativeTo: this.route
    });
  }

  // can be overridden to add more required columns
  protected getRequiredColumns() {
    return DEFAULT_REQUIRED_COLUMNS;
  }

  protected getUserColumns(): string[] {
    return this.settings.getPageSettings(this.settingsId, SETTINGS_DISPLAY_COLUMNS);
  }

  protected getSortedColumn(): MatSortable {
    const data = this.settings.getPageSettings(this.settingsId, SETTINGS_SORTED_COLUMN);
    const parts = data && data.split(':');
    if (parts && parts.length === 2 && this.columns.includes(parts[0])) {
      return {id: parts[0], start: parts[1] === 'desc' ? 'desc' : 'asc', disableClear: false};
    }
    if (this.defaultSortBy) {
       return {id: this.defaultSortBy, start: this.defaultSortDirection || 'asc', disableClear: false};
    }
    return {id: 'id', start: 'asc', disableClear: false};
  }

  protected getPageSize(): number {
    const pageSize = this.settings.getPageSettings<number>(this.settingsId, SETTINGS_PAGE_SIZE);
    return pageSize || this.defaultPageSize;
  }

  protected getDisplayColumns(): string[] {
    let userColumns = this.getUserColumns();

    // No user override
    if (!userColumns) {
      // Return default, without columns to hide
      return this.columns.filter(column => !this.excludesColumns.includes(column));
    }

    // Get fixed start columns
    const fixedStartColumns = this.columns.filter(c => RESERVED_START_COLUMNS.includes(c));

    // Remove end columns
    const fixedEndColumns = this.columns.filter(c => RESERVED_END_COLUMNS.includes(c));

    // Remove fixed columns from user columns
    userColumns = userColumns.filter(c => !fixedStartColumns.includes(c) && !fixedEndColumns.includes(c) && this.columns.includes(c));

    // Add required columns if missing
    userColumns.push(...this.getRequiredColumns().filter(c => !fixedStartColumns.includes(c) && !fixedEndColumns.includes(c) && !userColumns.includes(c)));

    return fixedStartColumns
      .concat(userColumns)
      .concat(fixedEndColumns)
      // Remove columns to hide
      .filter(column => !this.excludesColumns.includes(column));
  }

  /**
   * Recompute display columns
   *
   * @protected
   */
  protected updateColumns() {
    this.displayedColumns = this.getDisplayColumns();
    if (!this.loading) this.markForCheck();
  }

  protected registerSubscription(sub: Subscription) {
    this._subscription.add(sub);
  }

  protected unregisterSubscription(sub: Subscription) {
    this._subscription.remove(sub);
  }

  protected registerAutocompleteField(fieldName: string, options?: MatAutocompleteFieldAddOptions): MatAutocompleteFieldConfig {
    return this._autocompleteConfigHolder.add(fieldName, options);
  }

  protected getI18nColumnName(columnName: string) {
    return this.i18nColumnPrefix + changeCaseToUnderscore(columnName).toUpperCase();
  }

  protected generateTableId() {
    return this.location.path(true).replace(/[?].*$/g, '').replace(/\/[\d]+/g, '_id') + '_' + this.constructor.name;
    //if (this.debug) console.debug("[table] id = " + id);
    //return id;
  }

  protected async addRowToTable(insertAt?: number): Promise<TableElement<T>> {
    this.focusFirstColumn = true;
    await this._dataSource.asyncCreateNew(insertAt);
    this.editedRow = this._dataSource.getRow(-1);
    // Emit start editing event
    this.onStartEditingRow.emit(this.editedRow);
    this.totalRowCount++;
    this.visibleRowCount++;
    this.markAsDirty({emitEvent: false /*markForCheck() is called just after*/});
    this.markForCheck();
    return this.editedRow;
  }

  protected registerCellValueChanges(name: string, formPath?: string, emitInitialValue?: boolean): Observable<any> {
    formPath = formPath || name;
    emitInitialValue = emitInitialValue || false;
    let def = this._cellValueChangesDefs[name];
    if (def && (def.formPath !== formPath || def.emitInitialValue !== emitInitialValue)) {
      throw Error('Already register a cell value change for this name, with different \'formPath\' or \'emitInitialValue\'. Please use same arguments.');
    }

    // Not exists: register new definition
    if (!def) {
      if (this.debug) console.debug(`[table] New listener {${name}} for value changes on path ${formPath}`);
      def = {
        subject: new Subject<any>(),
        subscription: null,
        formPath,
        emitInitialValue
      };
      this._cellValueChangesDefs[name] = def;

      // Start the listener, when editing starts
      this.registerSubscription(
        this.onStartEditingRow.subscribe(row => this.startCellValueChanges(name, row)));
    }

    return def.subject;
  }

  protected setShowColumn(columnName: string, show: boolean, opts?: { emitEvent?: boolean }) {
    if (!this.excludesColumns.includes(columnName) !== show) {
      if (!show) {
        this.excludesColumns.push(columnName);
      } else {
        const index = this.excludesColumns.findIndex(value => value === columnName);
        if (index >= 0) this.excludesColumns.splice(index, 1);
      }

      // Recompute display columns
      if (this.displayedColumns && (!opts || opts.emitEvent !== false)) {
        this.updateColumns();
      }
    }
  }

  protected getShowColumn(columnName: string): boolean {
    return !this.excludesColumns.includes(columnName);
  }

  protected startsWithUpperCase(input: string, search: string): boolean {
    return input && input.toUpperCase().startsWith(search);
  }

  protected markForCheck() {
    // Should be override by subclasses, depending on ChangeDetectionStrategy
  }

  protected async askDeleteConfirmation(event?: UIEvent, rows?: TableElement<T>[]): Promise<boolean> {
    if (this.undoableDeletion) {
      // Special message, for undoable deletion
      return Alerts.askConfirmation(rows?.length === 1 ? 'CONFIRM.DELETE_ROW' : 'CONFIRM.DELETE_ROWS', this.alertCtrl, this.translate, event);
    }
    // Immediate deletion action
    return Alerts.askActionConfirmation(this.alertCtrl, this.translate, true, event);
  }

  protected async askCancelConfirmation(event?: UIEvent, rows?: TableElement<T>[]): Promise<boolean> {
    return Alerts.askConfirmation(rows?.length === 1 ? 'CONFIRM.CANCEL_ROW' : 'CONFIRM.CANCEL_ROWS', this.alertCtrl, this.translate, event);
  }

  protected async askRestoreConfirmation(event?: UIEvent): Promise<boolean> {
    return Alerts.askActionConfirmation(this.alertCtrl, this.translate, false, event);
  }

  protected async showToast(opts: ShowToastOptions) {
    if (!this.toastController) throw new Error('Missing toastController in component\'s constructor');
    return Toasts.show(this.toastController, this.translate, opts);
  }

  protected resetError(opts?: {emitEvent?: boolean;}) {
    this.setError(undefined, opts);
  }

  protected getRowError(row: TableElement<T>, separator?: string): string {
    if (!this.translate) return undefined;

    separator = separator || ', ';
    const errors = AppFormUtils.getFormErrors(row.validator);
    const i18nErrors = errors && Object.keys(errors).reduce((res, fieldName) => {
      const i18nFieldName = this.translate.instant(this.getI18nFieldName(fieldName));
      const columnErrors = Object.keys(errors[fieldName]).map(errorKey => this.getI18nError(errorKey, errors[errorKey]));
      if (isEmptyArray(columnErrors)) return res;
      // Add separator
      if (res.length) res += separator;
      return res + i18nFieldName + ": " + columnErrors.join(separator);
    }, "");
    return i18nErrors;
  }

  protected getI18nFieldName(fieldName: string) {
    // Use columns has default name
    // Can be override by subclasses, to resolve all field name
    return this.getI18nColumnName(fieldName);
  }

  protected getI18nError(errorKey: string, errorContent?: any): string {
    return SharedValidators.translateError((a,b) => this.translate.instant(a,b), errorKey, errorContent);
  }


  /* -- private method -- */

  private setLoading(value: boolean, opts?: {emitEvent?: boolean}) {
    if (this.loadingSubject.value !== value)  {
      this.loadingSubject.next(value);

      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  private setError(value: string, opts?: {emitEvent?: boolean;}) {
    if (this.errorSubject.value !== value) {
      this.errorSubject.next(value);
      if (!opts || opts.emitEvent !== false) {
        this.markForCheck();
      }
    }
  }

  private deleteNewRow(event: Event|undefined, row: TableElement<T>) {
    event?.stopPropagation();

    this.selection.clear();
    this.editedRow = undefined; // unselect row
    this._dataSource.cancelOrDelete(row);
    this.onCancelOrDeleteRow.next(row);
    this.resetError();
    this.totalRowCount--;
    this.visibleRowCount--;
  }

  private cancelOrDeleteExistingRow(event: Event|undefined, row: TableElement<T>, opts?: { interactive?: boolean; }) {

    const deletion = row.id === -1;
    const confirmed = (!opts || opts.interactive !== false);

    // Ask user confirmation, when delete
    if (deletion && !confirmed && (this.confirmBeforeDelete || this.onBeforeDeleteRows.observers.length > 0)) {
      event?.stopPropagation();
      this.canDeleteRows([row], opts)
        .then(confirm => {
          // If confirmed, loop
          if (confirm) this.cancelOrDeleteExistingRow(event, row, {interactive: false});
        });
      return;
    }
    // Ask user confirmation, if cancel
    else if (!deletion && !confirmed && row.validator?.dirty && (this.confirmBeforeCancel || this.onBeforeCancelRows.observers.length > 0)) {
      event.stopPropagation();
      this.canCancelRows([row], opts)
        .then(confirm => {
          // If confirmed, loop
          if (confirm) this.cancelOrDeleteExistingRow(event, row, {interactive: false});
        });
      return;
    }

    const keepEditing = !deletion && row.editing;
    this.editedRow = undefined; // unselect row
    this._dataSource.cancelOrDelete(row);
    this.onCancelOrDeleteRow.next(row);

    // Mark row as pristine
    const markRowAsPristine = !deletion && this.dataSource?.options.keepOriginalDataAfterConfirm === true;
    if (markRowAsPristine) {
      row.validator?.markAsPristine();
      // Check if table is now pristine
      this.checkIfPristine();
    }

    // Restore editing state
    if (keepEditing) {
      this.editRow(undefined, row);
    }
  }

  private async checkIfPristine(opts?: { emitEvent?: boolean; }) {
    if (!this.dirty) return; // Already pristine

    const rows = await this._dataSource.getRows();
    const pristine = (rows || []).findIndex(row => row.validator?.dirty) === -1;
    if (pristine) this.markAsPristine(opts);
  }

  private applyFilter(filter: F, opts: { emitEvent: boolean }) {
    if (this.debug) console.debug('[table] Applying filter', filter);
    this._filter = filter;
    if (opts && opts.emitEvent) {
      if (this.paginator && this.paginator.pageIndex > 0) {
        this.paginator.pageIndex = 0;
      }
      this.onRefresh.emit();
    }
  }

  private listenDatasourceLoading(dataSource: EntitiesTableDataSource<T, F, ID>) {
    if (!dataSource) throw new Error('[table] dataSource not set !');

    // Cleaning previous subscription on datasource
    if (isNotNil(this._dataSourceloadingSubscription)) {
      if (this.debug) console.debug('[table] Many call to listenDatasource(): Cleaning previous subscriptions...');
      this._dataSourceloadingSubscription.unsubscribe();
      this._subscription.remove(this._dataSourceloadingSubscription);
    }
    this._dataSourceloadingSubscription = this._dataSource.$busy
        .pipe(
            distinctUntilChanged(),

            // If changed to True: propagate as soon as possible
            tap((loading) => loading && this.setLoading(true)),

            // If changed to False: wait 250ms before propagate (to make sure the spinner has been displayed)
            debounceTime(250),
            tap(loading => !loading && this.setLoading(false))
        )
        .subscribe();

    this._subscription.add(this._dataSourceloadingSubscription);
  }


  private startCellValueChanges(name: string, row: TableElement<T>) {
    const def = this._cellValueChangesDefs[name];
    if (!def) {
      console.warn('[table] Listener with name {' + name + '} not registered! Please call registerCellValueChanges() before;');
      return;
    }
    // Stop previous subscription
    if (def.subscription) {
      def.subscription.unsubscribe();
      def.subscription = null;
    } else {
      if (this.debug) console.debug(`[table] Start values changes on row path {${def.formPath}}`);
    }

    // Listen value changes, and redirect to event emitter
    const control = row.validator && AppFormUtils.getControlFromPath(row.validator, def.formPath);
    if (!control) {
      console.warn(`[table] Could not listen cell changes: no validator or invalid form path {${def.formPath}}`);
    } else {
      def.subscription = control.valueChanges
        .pipe(
          // don't emit if control is disabled
          filter(() => control.enabled)
        )
        .subscribe((value) => def.subject.next(value));

      // Emit the actual value
      if (def.emitInitialValue !== false) {
        def.subject.next(control.value);
      }
    }
  }

  private stopCellValueChanges(name: string, destroy?: boolean) {
    const def = this._cellValueChangesDefs[name];
    if (!def) return;
    if (def.subscription) {
      if (this.debug) console.debug('[table] Stop value changes on row path {' + def.formPath + '}');
      def.subscription.unsubscribe();
      def.subscription = null;
    }
    if (destroy && def.subject) {
      def.subject.complete();
      def.subject.unsubscribe();
    }
  }
}

