import {ChangeDetectionStrategy, Component, Injector, Input, OnInit, ViewChild} from "@angular/core";
import {ValidatorService} from "@e-is/ngx-material-table";
import {FormBuilder, FormGroup} from "@angular/forms";
import {
  AppEntityEditor,
  EntityUtils,
  IReferentialRef,
  isNil,
  Referential,
  ReferentialRef
} from "../../core/core.module";
import {Program} from "../services/model/program.model";
import {
  AppliedPeriod,
  AppliedStrategy,
  Strategy,
  StrategyDepartment,
  TaxonNameStrategy
} from "../services/model/strategy.model";
import {ProgramValidatorService} from "../services/validator/program.validator";
import {
  fadeInOutAnimation
} from "../../shared/shared.module";
import {AccountService} from "../../core/services/account.service";
import {ReferentialUtils} from "../../core/services/model/referential.model";
import {ReferentialRefService} from "../services/referential-ref.service";
import {ModalController} from "@ionic/angular";
import {FormFieldDefinitionMap} from "../../shared/form/field.model";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {ProgramProperties} from "../services/config/program.config";
import {StrategyService} from "../services/strategy.service";
import {PlanificationForm} from "../planification/planification.form";
import {ActivatedRoute} from "@angular/router";
import {TaxonNameRef} from "../services/model/taxon.model";
import {PmfmStrategy} from "../services/model/pmfm-strategy.model";
import {Moment} from "moment";
import * as moment from 'moment'

export enum AnimationState {
  ENTER = 'enter',
  LEAVE = 'leave'
}

@Component({
  selector: 'app-simpleStrategy',
  templateUrl: 'simpleStrategy.page.html',
  providers: [
    {provide: ValidatorService, useExisting: ProgramValidatorService}
  ],
  animations: [fadeInOutAnimation,
    // Fade in
    trigger('fadeIn', [
      state('*', style({opacity: 0, display: 'none', visibility: 'hidden'})),
      state(AnimationState.ENTER, style({opacity: 1, display: 'inherit', visibility: 'inherit'})),
      state(AnimationState.LEAVE, style({opacity: 0, display: 'none', visibility: 'hidden'})),
      // Modal
      transition(`* => ${AnimationState.ENTER}`, [
        style({display: 'inherit',  visibility: 'inherit', transform: 'translateX(50%)'}),
        animate('0.4s ease-out', style({opacity: 1, transform: 'translateX(0)'}))
      ]),
      transition(`${AnimationState.ENTER} => ${AnimationState.LEAVE}`, [
        animate('0.2s ease-out', style({opacity: 0, transform: 'translateX(50%)'})),
        style({display: 'none',  visibility: 'hidden'})
      ]) ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimpleStrategyPage extends AppEntityEditor<Strategy, StrategyService> implements OnInit {

  propertyDefinitions = Object.getOwnPropertyNames(ProgramProperties).map(name => ProgramProperties[name]);
  fieldDefinitions: FormFieldDefinitionMap = {};
  form: FormGroup;
  i18nFieldPrefix = 'PROGRAM.';
  strategyFormState: AnimationState;

  @ViewChild('planificationForm', { static: true }) planificationForm: PlanificationForm;


  constructor(
    protected injector: Injector,
    protected formBuilder: FormBuilder,
    protected accountService: AccountService,
    protected validatorService: ProgramValidatorService,
    dataService: StrategyService,
    protected referentialRefService: ReferentialRefService,
    protected modalCtrl: ModalController,
    protected activatedRoute : ActivatedRoute
  ) {
    super(injector,
      Strategy,
      dataService);
    this.form = validatorService.getFormGroup();
    // default values
    this.defaultBackHref = "/referential?entity=Program";
    //this.defaultBackHref = "/referential/program/10?tab=2"; =>TODO : remplace 10 by id row
    this._enabled = this.accountService.isAdmin();
    this.tabCount = 4;

  }

  ngOnInit() {
    //  Call editor routing
  super.ngOnInit();

    // Set entity name (required for referential form validator)
    this.planificationForm.entityName = 'planificationForm';


   }

   protected canUserWrite(data: Strategy): boolean {
    // TODO : check user is in program managers
    return (this.isNewData && this.accountService.isAdmin())
      || (ReferentialUtils.isNotEmpty(data) && this.accountService.isSupervisor());

  }

  protected computeTitle(data: Strategy): Promise<string> {
    // new data
    if (!data || isNil(data.id)) {
      return this.translate.get('PROGRAM.NEW.TITLE').toPromise();
    }

    // Existing data
    return this.translate.get('PROGRAM.EDIT.TITLE', data).toPromise();
  }


  protected getFirstInvalidTabIndex(): number {
    if (this.planificationForm.invalid) return 0;
   // TODO
    return 0;
  }

  protected registerForms() {
    this.addChildForms([
      this.planificationForm
    ]);
  }

  updateView(data: Strategy | null, opts?: { emitEvent?: boolean; openTabIndex?: number; updateRoute?: boolean }) {
    super.updateView(data, opts);

    //if (this.isNewData && this.showBatchTables && isNotEmptyArray(this.batchTree.defaultTaxonGroups)) {
    //  this.batchTree.autoFill();
    //}
  }

  //protected setValue(data: Strategy) {
  protected setValue(data: Strategy, opts?: { emitEvent?: boolean; onlySelf?: boolean }) {

      if (!data) return; // Skip

    this.form.patchValue({...data, properties: [], strategies: []}, {emitEvent: false});

    /*this.simpleStrategyForm.value = data;
    //this.simpleStrategyForm.program = 40;*/
    //this.simpleStrategyForm.statusList =
   /* this.simpleStrategyForm.entityName= 'strategy';*/


    this.planificationForm.value = data;
    //this.simpleStrategyForm.program = 40;
    //this.simpleStrategyForm.statusList =
    //this.planificationForm.entityName= 'strategy';


    // Make sure to set entityName if set from Input()
    /*const entityNameControl = this.form.get('entityName');
    if (entityNameControl && this.entityName && entityNameControl.value !== this.entityName) {
      entityNameControl.setValue(this.entityName);
    }*/
    // Propagate value to planification form when automatic binding isn't set in super.setValue()
   // this.planificationForm.entityName= 'strategy';
    this.planificationForm.setValueSimpleStrategy(data, opts);


    this.markAsPristine();
  }



  protected async getJsonValueToSave(): Promise<Strategy> {

    const data = await super.getJsonValueToSave();
    // TODO : get programId
    data.programId=40;
   // data.__typename="StrategyVO";

    //Sample row code
    data.label =  this.planificationForm.form.get("label").value;
    data.name = this.planificationForm.form.get("label").value;
    //statusId
    data.statusId=1;

    //eotp
    data.analyticReference=this.planificationForm.form.get("analyticReference").value.label;

    data.analyticReference=this.planificationForm.form.get("analyticReference").value.label;
    //comments
    data.description = this.planificationForm.form.get("description").value;


    // get Id program from route
    console.log("programId : " + this.activatedRoute.snapshot.paramMap.get('id'));

    //get date ---------------------------------------------------------------------------------------------------------
    let newDate = this.planificationForm.form.get("creationDate").value;
    let year = new Date(newDate).getFullYear();

    //get Laboratories -------------------------------------------------------------------------------------------------

    let laboratories =  this.planificationForm.laboratoriesForm.value;

    let strategyDepartment: StrategyDepartment = new StrategyDepartment();
    let strategyDepartments: StrategyDepartment [] =[];


    if(laboratories){

      let observer : IReferentialRef = new ReferentialRef();
      observer.id =2;
      observer.label ="Observer";
      observer.name ="Observer privilege";
      observer.statusId =1;
      observer.entityName ="ProgramPrivilege";


      strategyDepartments   = laboratories.map(lab => ({
        strategyId : data.id,
        location : null,
        privilege :observer, //FIXME : get observer from referential ?
        department : lab
      })) ;

      data.strategyDepartments = strategyDepartments;
    }

    //TaxonNames -------------------------------------------------------------------------------------------------------

    let taxonNameStrategy =  this.planificationForm.taxonNamesForm.value;
    let taxonName: TaxonNameStrategy = new TaxonNameStrategy();
    let taxonNameStrategies: TaxonNameStrategy [] =[];

    if(taxonNameStrategy){
      taxonName.strategyId= data.id;
      taxonName.priorityLevel=null;
      taxonName.taxonName=taxonNameStrategy[0];
      //set reference TaxonId
      taxonName.taxonName.referenceTaxonId = taxonName.taxonName.id;
      taxonNameStrategies.push(taxonName);
      data.taxonNames =taxonNameStrategies;
    }

    //Fishig Area + Efforts --------------------------------------------------------------------------------------------

    let fishingArea = this.planificationForm.fishingAreasForm.value;
    let fishingAreas : AppliedStrategy [] = [];
    let appliedPeriods: AppliedPeriod[] = [];


    if (fishingArea) {

      // get quarters
      for(let i =0; i< 4;i++){
        let appliedPeriod: AppliedPeriod = new AppliedPeriod();
        appliedPeriod.appliedStrategyId =data.id;
        appliedPeriod.acquisitionNumber =fishingArea[i];

        //quarter 1
        if(i == 0){
          appliedPeriod.startDate = moment(year+"-01-01");
          appliedPeriod.endDate = moment(year+"-03-31");
        }

        //quarter 2
        if(i == 1){
          appliedPeriod.startDate =moment(year+"-04-01");
          appliedPeriod.endDate = moment(year+"-06-30");
        }

        //quarter 3
        if(i == 2){
          appliedPeriod.startDate = moment(year+"-07-01");
          appliedPeriod.endDate = moment(year+"-09-30");
        }

        //quarter 4
        if(i == 3){
          appliedPeriod.startDate = moment(year+"-10-01");
          appliedPeriod.endDate = moment(year+"-12-31");
        }

        //push only when acquisitionNumber is not null
        if(fishingArea[i] == null){
             console.log("dont push a null value");
        } else {
          appliedPeriods.push(appliedPeriod);
        }

        delete fishingArea[i];
      }


      fishingAreas = fishingArea.map(fish => ({
          strategyId: data.id,
          location: fish,
          appliedPeriods: appliedPeriods
        })
      );

      data.appliedStrategies = fishingAreas;
    }



    //PMFM + Fractions -------------------------------------------------------------------------------------------------

    /*let pmfmStrategie = this.planificationForm.pmfmStrategiesForm.value;
    let pmfmStrategies : PmfmStrategy [] = [];


    let sex = pmfmStrategie[0];
    let age = pmfmStrategie[1];


    for( let i = 0; i < pmfmStrategie.length; i++){
      // i == 0 age
      // i == 1 sex

      if(  i == 2){
        //push
        pmfmStrategies.push(pmfmStrategie[i]);
      }
      if( i == 3){
        //push
        pmfmStrategies.push(pmfmStrategie[i]);
      }
      //push
      if( i == 4){
        //push
        pmfmStrategies.push(pmfmStrategie[i]);
      }
      // fractions
      if(i > 4) {
        let calcifiedTypes : PmfmStrategy = new PmfmStrategy();
        calcifiedTypes.strategyId = data.id;
        calcifiedTypes.acquisitionLevel =
        calcifiedTypes.pmfm = null;
        calcifiedTypes.fractionId = pmfmStrategie[i].id;
        calcifiedTypes.qualitativeValues =undefined;
        calcifiedTypes.acquisitionLevel='SAMPLE'
        calcifiedTypes.acquisitionNumber=1;
        calcifiedTypes.isMandatory = false;
        calcifiedTypes.rankOrder = 1; //FIXME

        pmfmStrategies.push(calcifiedTypes);
      }
    }


    data.pmfmStrategies= pmfmStrategies;*/

    return data

  }

}

