import {Directive, Injector, Input} from "@angular/core";
import {ValidatorService} from "@e-is/ngx-material-table";
import {InMemoryEntitiesService} from "../../shared/services/memory-entity-service.class";
import {ActivatedRoute, Router} from "@angular/router";
import {ModalController, Platform} from "@ionic/angular";
import {Location} from "@angular/common";
import {isEmptyArray} from "../../shared/functions";
import {LocalSettingsService} from "../services/local-settings.service";
import {AppTableDataSourceOptions, EntitiesTableDataSource} from "./entities-table-datasource.class";
import {AppTable} from "./table.class";
import {IEntity} from "../services/model/entity.model";

// @dynamic
@Directive()
// tslint:disable-next-line:directive-class-suffix
export abstract class AppInMemoryTable<
  T extends IEntity<T, ID>,
  F = any,
  ID = number
  > extends AppTable<T, F, ID> {

  @Input() canEdit = false;
  @Input() canDelete = false;

  set value(data: T[]) {
    this.setValue(data);
  }

  get value(): T[] {
    return this.memoryDataService.value;
  }

 /* get dirty(): boolean {
    return this._dirty || this.memoryDataService.dirty;
  }*/

  protected constructor(
    protected injector: Injector,
    protected columns: string[],
    protected dataType: new () => T,
    protected memoryDataService: InMemoryEntitiesService<T, F, ID>,
    protected validatorService: ValidatorService,
    options?: AppTableDataSourceOptions<T, ID>,
    filter?: F
  ) {
    super(injector.get(ActivatedRoute),
      injector.get(Router),
      injector.get(Platform),
      injector.get(Location),
      injector.get(ModalController),
      injector.get(LocalSettingsService),
      columns,
      new EntitiesTableDataSource<T, F, ID>(dataType, memoryDataService, validatorService, options),
      filter,
      injector);

    this.autoLoad = false; // waiting value to be set
  }

  ngOnInit() {
    super.ngOnInit();
  }

  setValue(value: T[], opts?: { emitEvent?: boolean; }) {
    // Reset previous error
    if (this.error) {
      this.error = null;
      this.markForCheck();
    }
    const firstCall = isEmptyArray(this.memoryDataService.value);

    // TODO BLA: review
    //this.memoryDataService.setValue(value, {emitEvent: false});
    this.memoryDataService.value = value;

    if (firstCall || (opts && opts.emitEvent !== false)) {
      this.onRefresh.emit();
    }
  }
}

