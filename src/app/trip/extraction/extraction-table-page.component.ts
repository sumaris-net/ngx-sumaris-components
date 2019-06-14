import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Injector,
  OnInit,
  ViewChild
} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {isNil} from '../../shared/shared.module';
import {TableDataSource} from "angular4-material-table";
import {
  AggregationType,
  ExtractionColumn,
  ExtractionResult,
  ExtractionRow,
  ExtractionType
} from "../services/extraction.model";
import {FormBuilder, Validators} from "@angular/forms";
import {MatExpansionPanel, MatPaginator, MatSort, MatTable} from "@angular/material";
import {merge} from "rxjs/observable/merge";
import {TableSelectColumnsComponent} from "../../core/table/table-select-columns.component";
import {SETTINGS_DISPLAY_COLUMNS} from "../../core/table/table.class";
import {ModalController} from "@ionic/angular";
import {Location} from "@angular/common";
import {ExtractionForm} from "./extraction-filter.form";
import {LocalSettingsService} from "../../core/core.module";
import {map, tap} from "rxjs/operators";

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_CRITERION_OPERATOR = '=';

@Component({
  selector: 'app-extraction-table',
  templateUrl: './extraction-table-page.component.html',
  styleUrls: ['./extraction-table-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExtractionTablePage extends ExtractionForm<ExtractionType> implements OnInit {

  data: ExtractionResult;
  $title = new Subject<string>();
  columns: string[];
  displayedColumns: string[];
  $columns = new BehaviorSubject<ExtractionColumn[]>(undefined);
  dataSource: TableDataSource<ExtractionRow>;
  settingsId: string;
  showHelp = true;
  canAggregate = false;

  @ViewChild(MatTable) table: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatExpansionPanel) filterExpansionPanel: MatExpansionPanel;

  constructor(
    injector: Injector,
    protected formBuilder: FormBuilder,
    protected location: Location,
    protected settings: LocalSettingsService,
    protected modalCtrl: ModalController,
    protected cd: ChangeDetectorRef
  ) {
    super(injector,
      formBuilder.group({
        'type': [null, Validators.required],
        'sheetName': [null],
        'sheets': formBuilder.group({})
      }));

    this.displayedColumns = [];
    this.dataSource = new TableDataSource<ExtractionRow>([], ExtractionRow);
  }

  ngOnInit() {

    super.ngOnInit();

    // If the user changes the sort order, reset back to the first page.
    this.sort && this.paginator && this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0);

    merge(
      this.sort && this.sort.sortChange || EventEmitter.empty(),
      this.paginator && this.paginator.page || EventEmitter.empty(),
      this.onRefresh
    )
      .subscribe(() => {
        if (this.loading || isNil(this.type)) return; // avoid multiple load
        return this.load(this.type);
      });
  }

  protected loadTypes(): Observable<ExtractionType[]> {
    return this.service.loadTypes()
      .pipe(
        // Compute name, if need
        tap(types => types.forEach(t => t.name = t.name || this.getI18nTypeName(t))),
        // Sort by name
        map(types => types.sort((t1, t2) => t1.name > t2.name ? 1 : (t1.name < t2.name ? -1 : 0) ))
      );
  }

  protected fromObject(json: any): ExtractionType {
    return ExtractionType.fromObject(json);
  }

  protected async load(type?: ExtractionType) {

    this.loading = true;
    this.markForCheck();
    this.type = type || this.form.get('type').value;

    this.settingsId = this.generateTableId();
    this.error = null;
    console.debug(`[extraction-table] Loading ${this.type.category} ${this.type.label}`);

    const filter = this.getFilterValue();
    this.disable();

    try {
      // Load rows
      const data = await this.service.loadRows(this.type,
        this.paginator && this.paginator.pageIndex * this.paginator.pageSize,
        this.paginator && this.paginator.pageSize || DEFAULT_PAGE_SIZE,
        this.sort && this.sort.active,
        this.sort && this.sort.direction,
        filter
      );

      // Update the view
      await this.updateView(data);
    } catch (err) {
      console.error(err);
      this.error = err && err.message || err;
      this.loading = false;
      this.enable();
      this.markAsDirty();
    }
  }

  async updateView(data: ExtractionResult) {

    this.data = data;

    // Update columns
    this.columns = data.columns.slice()
    // Sort by rankOder
      .sort((col1, col2) => col1.rankOrder - col2.rankOrder)
      .map(col => col.name);
    this.displayedColumns = this.columns
      .filter(columnName => columnName !== "id"); // Remove id
    this.$columns.next(data.columns);

    // Update rows
    this.dataSource.updateDatasource(data.rows || []);

    // Update title
    await this.updateTitle();

    this.dataSource.connect().first().subscribe(() => {
      this.loading = false;
      this.enable();
      this.markAsUntouched();
      this.markAsPristine();
      this.markForCheck();
    });
  }

  async setType(type: ExtractionType<ExtractionType<any>>, opts?: { emitEvent?: boolean; skipLocationChange?: boolean; sheetName?: string }): Promise<void> {
    await super.setType(type, opts);

    this.canAggregate = !this.type.isSpatial && this.accountService.isSupervisor();
  }

  onSheetChange(sheetName: string) {
    // Skip if same, or loading
    if (this.loading || isNil(sheetName) || this.sheetName === sheetName) return;

    // Reset sort
    this.sort.active = undefined;

    super.onSheetChange(sheetName);
  }

  public async openSelectColumnsModal(event: any): Promise<any> {
    const columns = this.columns
      .map((name, index) => {
        return {
          name,
          label: this.getI18nColumnName(name),
          visible: this.displayedColumns.indexOf(name) !== -1
        };
      });

    const modal = await this.modalCtrl.create({
      component: TableSelectColumnsComponent,
      componentProps: {columns: columns}
    });

    // On dismiss
    modal.onDidDismiss()
      .then(res => {
        if (!res) return; // CANCELLED

        // Apply columns
        this.displayedColumns = columns && columns.filter(c => c.visible).map(c => c.name) || [];

        // Update local settings
        return this.settings.savePageSetting(this.settingsId, this.displayedColumns, SETTINGS_DISPLAY_COLUMNS);
      });
    return modal.present();
  }


  public resetFilterCriteria() {

    // Close the filter panel
    if (this.filterExpansionPanel && this.filterExpansionPanel.expanded) {
      this.filterExpansionPanel.close();
    }

    super.resetFilterCriteria();
  }

  public onCellValueClick($event: MouseEvent, column: ExtractionColumn, value: string) {
    const hasChanged = this.addFilterCriterion({
      name: column.name,
      operator: DEFAULT_CRITERION_OPERATOR,
      value: value,
      sheetName: this.sheetName
    }, {
      appendValue: $event.ctrlKey
    });
    if (!hasChanged) return;

    if (!this.filterExpansionPanel.expanded) {
      this.filterExpansionPanel.open();
    }

    if (!$event.ctrlKey) {
      this.onRefresh.emit();
    }
  }


  async aggregate() {
    if (!this.type || !this.canAggregate) return; // Skip

    this.loading = true;
    this.markForCheck();
    let type = Object.assign({}, this.form.get('type').value);

    const filter = this.getFilterValue();
    this.disable();

    try {

      const name = await this.translate.get('EXTRACTION.AGGREGATION.NEW_NAME', {name: type.name}).toPromise();
      // Compute a new name
      const aggType = AggregationType.fromObject({
        label: `${this.type.label}-${this.accountService.account.id}-${Date.now()}`,
        category: this.type.category,
        name: name
      });

      // Save aggregation
      const savedType = await this.service.saveAggregation(aggType, filter);
      this.loading = false;

      // Wait for types cache updates
      await setTimeout(() => {}, 1000);

      // Open the new aggregation
      await this.setType(savedType, {emitEvent: true, skipLocationChange: false, sheetName: undefined});

    } catch (err) {
      console.error(err);
      this.error = err && err.message || err;
      this.markAsDirty();
    } finally {
      this.loading = false;
      this.enable();
    }

  }

  async deleteAggregation() {
    if (!this.type || isNil(this.type.id)) return;

    if (!this.type.isSpatial) {
      console.warn("[extraction-table] Only spatial extraction can be deleted !");
      return;
    }

    this.loading = true;

    try {
      await this.service.deleteAggregations([this.type as AggregationType]);
    }
    catch(err) {
      console.error(err);
      this.error = err && err.message || err;
      this.markAsDirty();
    }
    finally {
      this.loading = false;
    }

  }

  async openMap() {
    if (!this.type || !this.type.isSpatial) return; // Skip

    // open the map
    await this.router.navigateByUrl('/map', {
      queryParams:  this.getFilterAsQueryParams()
    });
  }

  /* -- private method -- */

  private async updateTitle() {
    const key = `EXTRACTION.CATEGORY.${this.type.category.toUpperCase()}`;
    const title = await this.translate.get(key).toPromise();
    if (title === key) {
      console.warn("Missing i18n key '" + key + "'");
      this.$title.next("");
    } else {
      this.$title.next(title);
    }
  }

  private generateTableId() {
    const id = this.location.path(true).replace(/[?].*$/g, '').replace(/\/[\d]+/g, '_id') + "_" + this.constructor.name;
    return id;
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
