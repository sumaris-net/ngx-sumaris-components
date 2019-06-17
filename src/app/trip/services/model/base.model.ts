import {
  Cloneable,
  Entity,
  entityToString,
  fromDateISOString,
  isNil,
  isNotNil,
  LocationLevelIds,
  personsToString,
  personToString,
  referentialToString,
  StatusIds,
  toDateISOString
} from "../../../core/core.module";
import {
  Department,
  EntityUtils,
  GearLevelIds,
  getPmfmName,
  Person,
  PmfmStrategy,
  QualityFlagIds,
  Referential,
  ReferentialRef,
  TaxonGroupIds,
  AcquisitionLevelCodes,
  VesselFeatures,
  vesselFeaturesToString
} from "../../../referential/referential.module";
import {Moment} from "moment/moment";
import {IWithProgramEntity} from "../../../referential/services/model";


export {
  Referential, ReferentialRef, EntityUtils, Person, Department,
  toDateISOString, fromDateISOString, isNotNil, isNil,
  vesselFeaturesToString, entityToString, referentialToString, personToString, personsToString, getPmfmName,
  StatusIds, Cloneable, Entity, VesselFeatures, LocationLevelIds, GearLevelIds, TaxonGroupIds, QualityFlagIds,
  PmfmStrategy, AcquisitionLevelCodes
};


/* -- Helper function -- */

export function fillRankOrder(values: { rankOrder: number }[]) {
  // Compute rankOrder
  let maxRankOrder = 0;
  (values || []).forEach(m => {
    if (m.rankOrder && m.rankOrder > maxRankOrder) maxRankOrder = m.rankOrder;
  });
  (values || []).forEach(m => {
    m.rankOrder = m.rankOrder || maxRankOrder++;
  });
}

/* -- Data entity -- */

export interface IWithRecorderDepartmentEntity<T> extends Entity<T> {
  recorderDepartment: Department|ReferentialRef|Referential;
}

export interface IWithRecorderPersonEntity<T> extends Entity<T> {
  recorderPerson: Person;
}

export interface IWithVesselFeaturesEntity<T> extends Entity<T> {
  vesselFeatures: VesselFeatures;
}
export interface IWithObserversEntity<T> extends Entity<T> {
  observers: Person[];
}

export abstract class DataEntity<T> extends Entity<T> implements IWithRecorderDepartmentEntity<T> {
  recorderDepartment: Department;
  controlDate: Moment;
  qualificationDate: Moment;
  qualificationComments: string;
  qualityFlagId: number;

  protected constructor() {
    super();
    this.recorderDepartment = new Department();
  }

  asObject(minify?: boolean): any {
    const target = super.asObject(minify);
    target.recorderDepartment = this.recorderDepartment && this.recorderDepartment.asObject(minify) || undefined;
    target.controlDate = toDateISOString(this.controlDate);
    target.qualificationDate = toDateISOString(this.qualificationDate);
    target.qualificationComments = this.qualificationComments || undefined;
    target.qualityFlag = this.qualityFlagId || undefined;
    return target;
  }

  fromObject(source: any): DataEntity<T> {
    super.fromObject(source);
    source.recorderDepartment && this.recorderDepartment.fromObject(source.recorderDepartment);
    this.controlDate = fromDateISOString(source.controlDate);
    this.qualificationDate = fromDateISOString(source.qualificationDate);
    this.qualificationComments = source.qualificationComments;
    this.qualityFlagId = source.qualityFlagId;
    return this;
  }

}

export abstract class DataRootEntity<T> extends DataEntity<T> implements IWithRecorderPersonEntity<T>, IWithProgramEntity<T> {
  creationDate: Moment;
  validationDate: Moment;
  comments: string = null;
  recorderPerson: Person;
  program: ReferentialRef;

  protected constructor() {
    super();
    this.creationDate = null;
    this.validationDate = null;
    this.comments = null;
    this.recorderPerson = new Person();
    this.program = new ReferentialRef();
  }

  asObject(minify?: boolean): any {
    const target = super.asObject(minify);
    target.creationDate = toDateISOString(this.creationDate);
    target.validationDate = toDateISOString(this.validationDate);
    target.recorderPerson = this.recorderPerson && this.recorderPerson.asObject(minify) || undefined;
    target.program = this.program && this.program.asObject(false/*keep for trips list*/) || undefined;
    return target;
  }

  fromObject(source: any): DataRootEntity<T> {
    super.fromObject(source);
    this.comments = source.comments;
    this.creationDate = fromDateISOString(source.creationDate);
    this.validationDate = fromDateISOString(source.validationDate);
    source.recorderPerson && this.recorderPerson.fromObject(source.recorderPerson);
    source.program && this.program.fromObject(source.program);
    return this;
  }
}


export abstract class DataRootVesselEntity<T> extends DataRootEntity<T> implements IWithVesselFeaturesEntity<T> {
  vesselFeatures: VesselFeatures;

  protected constructor() {
    super();
    this.vesselFeatures = new VesselFeatures();
  }

  asObject(minify?: boolean): any {
    const target = super.asObject();
    target.vesselFeatures = this.vesselFeatures && this.vesselFeatures.asObject(minify) || undefined;
    return target;
  }

  fromObject(source: any): DataRootVesselEntity<T> {
    super.fromObject(source);
    source.vesselFeatures && this.vesselFeatures.fromObject(source.vesselFeatures);
    return this;
  }
}