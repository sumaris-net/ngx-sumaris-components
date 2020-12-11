import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Injector,
  Input,
  OnDestroy,
  OnInit
} from "@angular/core";
import {ValidatorService} from "@e-is/ngx-material-table";
import {StrategyValidatorService} from "../services/validator/strategy.validator";
import {Strategy} from "../services/model/strategy.model";
import {InMemoryEntitiesService} from "../../shared/services/memory-entity-service.class";
import {toBoolean} from "../../shared/functions";
import {DefaultStatusList, referentialToString} from "../../core/services/model/referential.model";
import {AppInMemoryTable} from "../../core/table/memory-table.class";
import {RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from "../../core/table/table.class";
import {EnvironmentService} from "../../../environments/environment.class";

// tslint:disable-next-line:no-empty-interface
export declare interface StrategyFilter {
}

@Component({
  selector: 'app-strategy-table',
  templateUrl: 'strategies.table.html',
  styleUrls: ['strategies.table.scss'],
  providers: [
    {provide: ValidatorService, useExisting: StrategyValidatorService},
    {
      provide: InMemoryEntitiesService,
      useFactory: () => new InMemoryEntitiesService<Strategy, StrategyFilter>(Strategy, {})
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StrategiesTable extends AppInMemoryTable<Strategy, StrategyFilter> implements OnInit, OnDestroy {

  statusList = DefaultStatusList;
  statusById: any;

  @Input() canEdit = false;
  @Input() canDelete = false;


  constructor(
    protected injector: Injector,
    protected memoryDataService: InMemoryEntitiesService<Strategy, StrategyFilter>,
    protected validatorService: ValidatorService,
    protected cd: ChangeDetectorRef,
    @Inject(EnvironmentService) protected environment
  ) {
    super(injector,
      // columns
      RESERVED_START_COLUMNS
        .concat([
          'label',
          'name',
          'description',
          'status',
          'comments'])
        .concat(RESERVED_END_COLUMNS),
      Strategy,
      memoryDataService,
      validatorService,
      null,
      {});

    this.i18nColumnPrefix = 'REFERENTIAL.';
    this.autoLoad = false; // waiting parent to load

    this.confirmBeforeDelete = true;

    // Fill statusById
    this.statusById = {};
    this.statusList.forEach((status) => this.statusById[status.id] = status);

    this.debug = !environment.production;
  }

  ngOnInit() {
    this.inlineEdition = toBoolean(this.inlineEdition, true);
    super.ngOnInit();
  }


  setValue(value: Strategy[]) {
    super.setValue(value);
  }

  referentialToString = referentialToString;

  protected markForCheck() {
    this.cd.markForCheck();
  }
}

