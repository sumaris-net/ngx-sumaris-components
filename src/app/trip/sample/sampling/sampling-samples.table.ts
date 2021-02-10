import {ChangeDetectionStrategy, Component, Injector, Input} from "@angular/core";
import {ValidatorService} from "@e-is/ngx-material-table";
import {SampleValidatorService} from "../../services/validator/sample.validator";
import {isEmptyArray, isNotEmptyArray, isNotNil} from "../../../shared/functions";
import {PmfmStrategy} from "../../../referential/services/model/pmfm-strategy.model";
import {ReferentialRefService} from "../../../referential/services/referential-ref.service";
import {environment} from "../../../../environments/environment";
import {BehaviorSubject} from "rxjs";
import {ObjectMap} from "../../../shared/types";
import {firstNotNilPromise} from "../../../shared/observables";
import {SelectReferentialModal} from "../../../referential/list/select-referential.modal";
import {SamplesTable, SamplesTableOptions} from "../samples.table";
import {PmfmFilter, PmfmService} from "../../../referential/services/pmfm.service";
import {ProgramRefService} from "../../../referential/services/program-ref.service";
import {SelectPmfmModal} from "../../../referential/pmfm/select-pmfm.modal";

export interface SampleFilter {
  operationId?: number;
  landingId?: number;
}

const SAMPLE_RESERVED_START_COLUMNS: string[] = ['label'];
const SAMPLE_RESERVED_END_COLUMNS: string[] = ['comments'];
const SAMPLE_PARAMETER_GROUPS = ['ANALYTIC_REFERENCE', 'WEIGHT', 'LENGTH', 'MATURITY', 'SEX', 'AGE', 'OTHER'];

declare interface GroupColumnDefinition {
  key: string;
  label?: string;
  name?: string;
  colSpan: number;
  cssClass?: string;
}

@Component({
  selector: 'app-sampling-samples-table',
  templateUrl: 'sampling-samples.table.html',
  styleUrls: ['sampling-samples.table.scss'],
  providers: [
    {provide: ValidatorService, useExisting: SampleValidatorService}
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SamplingSamplesTable extends SamplesTable {

  protected referentialRefService: ReferentialRefService;
  protected _$pmfmGroups = new BehaviorSubject<ObjectMap<number[]>>(null);

  $pmfmGroupColumns = new BehaviorSubject<GroupColumnDefinition[]>([]);

  @Input() set pmfmGroups(value: ObjectMap<number[]>) {
    this._$pmfmGroups.next(value);
  }

  get pmfmGroups(): ObjectMap<number[]> {
    return this._$pmfmGroups.getValue();
  }

  constructor(
    protected injector: Injector,
    protected programRefService: ProgramRefService,
    protected pmfmService: PmfmService
  ) {
    super(injector,
      <SamplesTableOptions>{
        prependNewElements: false,
        suppressErrors: environment.production,
        reservedStartColumns: SAMPLE_RESERVED_START_COLUMNS,
        reservedEndColumns: SAMPLE_RESERVED_END_COLUMNS,
        mapPmfms: pmfms => this.mapPmfms(pmfms)
      }
    );
  }

  /**
   * Use in ngFor, for trackBy
   * @param index
   * @param column
   */
  trackColumnDef(index: number, column: GroupColumnDefinition) {
    return column.key;
  }

  /**
   * Not used yet. Implementation must manage stored samples values and different pmfms types (number, string, qualitative values...)
   * @param event
   */
  async openChangePmfmsModal(event?: UIEvent) {
    const existingPmfmIds = (this.$pmfms.getValue() || []).map(p => p.pmfmId).filter(isNotNil);

    const pmfmIds = await this.openSelectPmfmsModal(event, {
      excludedIds: existingPmfmIds
    }, {
      allowMultiple: false
    });
    if (!pmfmIds) return; // USer cancelled

    console.debug('TODO changes to pmfm: ', pmfmIds);
  }


  async openAddPmfmsModal(event?: UIEvent) {
    const existingPmfmIds = (this.$pmfms.getValue() || []).map(p => p.pmfmId).filter(isNotNil);

    const pmfmIds = await this.openSelectPmfmsModal(event, {
      excludedIds: existingPmfmIds
    }, {
      allowMultiple: false
    });
    if (!pmfmIds) return; // USer cancelled
    await this.addPmfmColumns(pmfmIds);

  }


  /* -- protected methods -- */

  /**
   * Force to wait PMFM map to be loaded
   * @param pmfms
   */
  protected async mapPmfms(pmfms: PmfmStrategy[]): Promise<PmfmStrategy[]> {
    if (isEmptyArray(pmfms)) return pmfms;

    // Wait until map is loaded
    const groupedPmfmIdsMap = await firstNotNilPromise(this._$pmfmGroups);

    // Create a list of known pmfm ids
    const groupedPmfmIds = Object.values(groupedPmfmIdsMap).reduce((res, pmfmIds) => res.concat(...pmfmIds), []);

    // Create pmfms group
    const orderedPmfmIds: number[] = [];
    const orderedPmfms: PmfmStrategy[] = [];
    let groupIndex = 0;
    const pmfmGroupColumns: GroupColumnDefinition[] = SAMPLE_PARAMETER_GROUPS.reduce((pmfmGroups, group) => {
      let groupPmfms: PmfmStrategy[];
      if (group === 'OTHER') {
        groupPmfms = pmfms.filter(p => !groupedPmfmIds.includes(p.pmfmId));
      }
      else {
        const groupPmfmIds = groupedPmfmIdsMap[group];
        if (isNotEmptyArray(groupPmfmIds)) {
          groupPmfms = pmfms.filter(p => groupPmfmIds.includes(p.pmfmId));
        }
      }

      if (isEmptyArray(groupPmfms)) return pmfmGroups; // Skip group


      const groupPmfmCount = groupPmfms.length;
      let cssClass = (++groupIndex) % 2 === 0 ? 'even' : 'odd';


      groupPmfms.forEach(pmfm =>  {
        pmfm = pmfm.clone(); // Clone, to leave original PMFM unchanged

        // Use rankOrder as a group index (will be used in template, to computed column class)
        pmfm.rankOrder = groupIndex;

        // Add pmfm into the final list of ordered pmfms
        orderedPmfms.push(pmfm);
      });

      // The analytic reference has no visible header group
      if (group === 'ANALYTIC_REFERENCE') cssClass += ' hidden';

      return pmfmGroups.concat(
        ...groupPmfms.reduce((res, pmfm, index) => {
          if (orderedPmfmIds.includes(pmfm.pmfmId)) return res; // Skip if already proceed
          orderedPmfmIds.push(pmfm.pmfmId);
          return res.concat(<GroupColumnDefinition>{
            key: pmfm.pmfmId.toString(),
            label: group,
            name: this.i18nColumnPrefix + group,
            cssClass,
            colSpan: index === 0 ? groupPmfmCount : 0
          });
        }, []));
    }, []);

    this.$pmfmGroupColumns.next(pmfmGroupColumns);

    return orderedPmfms;
  }


  protected async openSelectPmfmsModal(event?: UIEvent, filter?: PmfmFilter,
                                       opts?: {
                                         allowMultiple?: boolean;
                                       }): Promise<number[]> {

    const modal = await this.modalCtrl.create({
      component: SelectPmfmModal,
      componentProps: {
        filter,
        allowMultiple: opts && opts.allowMultiple
      },
      keyboardClose: true,
      cssClass: 'modal-large'
    });

    // Open the modal
    await modal.present();

    // On dismiss
    const res = await modal.onDidDismiss();
    if (!res || isEmptyArray(res.data)) return; // CANCELLED

    // Return pmfm ids
    return res.data.map(p => p.id);
  }

  protected async addPmfmColumns(pmfmIds: number[]) {
    if (isEmptyArray(pmfmIds)) return; // Skip if empty

    const pmfms = (await Promise.all(pmfmIds.map(pmfmId => this.pmfmService.load(pmfmId))))
      .map(PmfmStrategy.fromPmfm);

    this.pmfms = [
      ...this.$pmfms.getValue(),
      ...pmfms
    ];
  }
}
