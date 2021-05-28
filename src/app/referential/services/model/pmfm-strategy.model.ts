import {Entity, EntityAsObjectOptions, isInstanceOf} from "../../../core/services/model/entity.model";
import {IPmfm, Pmfm, PMFM_NAME_REGEXP, PmfmType, PmfmUtils} from "./pmfm.model";
import {NOT_MINIFY_OPTIONS, ReferentialRef} from "../../../core/services/model/referential.model";
import {isNotNil, toNumber} from "../../../shared/functions";
import {PmfmValue, PmfmValueUtils} from "./pmfm-value.model";
import {MethodIds} from "./model.enum";
import {EntityClass} from "../../../core/services/model/entity.decorators";


/**
 * Compute a PMFM.NAME, with the last part of the name
 * @param pmfm
 * @param opts
 */
export function getPmfmName(pmfm: IPmfm, opts?: {
  withUnit?: boolean;
  html?: boolean;
  withDetails?: boolean;
}): string {
  if (!pmfm) return undefined;

  let name;
  if (isInstanceOf(pmfm, DenormalizedPmfmStrategy)) {
    // Is complete name exists, use it
    if (opts && opts.withDetails && pmfm.completeName) return pmfm.completeName;

    // Remove parenthesis content, if any
    const matches = PMFM_NAME_REGEXP.exec(pmfm.name || '');
    name = matches && matches[1] || pmfm.name;
  }
  else if (pmfm instanceof Pmfm) {
    name = pmfm.parameter && pmfm.parameter.name;
    if (opts && opts.withDetails) {
      name += [
        pmfm.matrix && pmfm.matrix.name,
        pmfm.fraction && pmfm.fraction.name,
        pmfm.method && pmfm.method.name
      ].filter(isNotNil).join(' - ');
    }
  }

  // Append unit
  if ((!opts || opts.withUnit !== false) && (pmfm.type === 'integer' || pmfm.type === 'double') && pmfm.unitLabel) {
    if (opts && opts.html) {
      name += `<small><br/>(${pmfm.unitLabel})</small>`;
    }
    else {
      name += ` (${pmfm.unitLabel})`;
    }
  }
  return name;
}

// @dynamic
@EntityClass({typename: "PmfmStrategyVO"})
export class PmfmStrategy extends Entity<PmfmStrategy> {

  static fromObject: (source: any, opts?: any) => PmfmStrategy;

  pmfmId: number;
  pmfm: Pmfm;
  parameter: ReferentialRef;
  matrix: ReferentialRef;
  fraction: ReferentialRef;
  method: ReferentialRef;

  acquisitionNumber: number;
  minValue: number;
  maxValue: number;
  defaultValue: PmfmValue;
  isMandatory: boolean;
  rankOrder: number;
  acquisitionLevel: string|ReferentialRef;

  gearIds: number[];
  taxonGroupIds: number[];
  referenceTaxonIds: number[];

  strategyId: number;
  hidden?: boolean;

  constructor() {
    super(PmfmStrategy.TYPENAME);
  }

  asObject(options?: EntityAsObjectOptions): any {
    const target: any = super.asObject(options);
    target.acquisitionLevel = (target.acquisitionLevel && typeof target.acquisitionLevel === "object" && target.acquisitionLevel.label)
      || target.acquisitionLevel;

    target.pmfmId = toNumber(this.pmfmId, this.pmfm && this.pmfm.id);
    target.pmfm = this.pmfm && this.pmfm.asObject({...NOT_MINIFY_OPTIONS, ...options});
    target.parameter = this.parameter && this.parameter.asObject({...NOT_MINIFY_OPTIONS, ...options});
    target.matrix = this.matrix && this.matrix.asObject({...NOT_MINIFY_OPTIONS, ...options});
    target.fraction = this.fraction && this.fraction.asObject({...NOT_MINIFY_OPTIONS, ...options});
    target.method = this.method && this.method.asObject({...NOT_MINIFY_OPTIONS, ...options});

    // Serialize default value
    // only if NOT an alphanumerical value (DB column is a double) or a computed PMFM
    if (this.defaultValue && (!this.isAlphanumeric && !this.isComputed)) {
      target.defaultValue = +(PmfmValueUtils.toModelValue(this.defaultValue, this.pmfm));
    }
    else {
      delete target.defaultValue;
    }

    return target;
  }

  fromObject(source: any, opts?: any) {
    super.fromObject(source, opts);

    this.pmfm = source.pmfm && Pmfm.fromObject(source.pmfm);
    this.pmfmId = toNumber(source.pmfmId, source.pmfm && source.pmfm.id);
    this.parameter = source.parameter && ReferentialRef.fromObject(source.parameter);
    this.matrix = source.matrix && ReferentialRef.fromObject(source.matrix);
    this.fraction = source.fraction && ReferentialRef.fromObject(source.fraction);
    this.method = source.method && ReferentialRef.fromObject(source.method);

    this.minValue = source.minValue;
    this.maxValue = source.maxValue;
    this.defaultValue = source.defaultValue;
    this.acquisitionNumber = source.acquisitionNumber;
    this.isMandatory = source.isMandatory;
    this.rankOrder = source.rankOrder;
    this.acquisitionLevel = source.acquisitionLevel;
    this.gearIds = source.gearIds && [...source.gearIds] || undefined;
    this.taxonGroupIds = source.taxonGroupIds && [...source.taxonGroupIds] || undefined;
    this.referenceTaxonIds = source.referenceTaxonIds && [...source.referenceTaxonIds] || undefined;
    this.strategyId = source.strategyId;
  }

  get required(): boolean {
    return this.isMandatory;
  }

  set required(value: boolean) {
    this.isMandatory = value;
  }

  get type(): string|PmfmType {
    return this.pmfm && this.pmfm.type;
  }

  get isNumeric(): boolean {
    return this.type === 'integer' || this.type === 'double';
  }

  get isAlphanumeric(): boolean {
    return this.type === 'string';
  }

  get isDate(): boolean {
    return this.type === 'date';
  }

  get isComputed(): boolean {
    return this.method && this.method.id === MethodIds.CALCULATED;
  }

  get isQualitative(): boolean {
    return this.type === 'qualitative_value';
  }

  equals(other: PmfmStrategy): boolean {
    return other && (this.id === other.id
      // Same acquisitionLevel, pmfm, parameter
      || (this.strategyId === other.strategyId && this.acquisitionLevel === other.acquisitionLevel
        && ((!this.pmfm && !other.pmfm) || (this.pmfm && other.pmfm && this.pmfm.id === other.pmfm.id))
        && ((!this.parameter && !other.parameter) || (this.parameter && other.parameter && this.parameter.id === other.parameter.id))
      )
    );
  }
}

// @dynamic
@EntityClass({typename: 'DenormalizedPmfmStrategyVO'})
export class DenormalizedPmfmStrategy
  extends Entity<DenormalizedPmfmStrategy>
  implements IPmfm<DenormalizedPmfmStrategy> {

  static fromObject: (source: any, opts?: any) => DenormalizedPmfmStrategy;

  label: string;
  name: string;
  completeName: string;
  unitLabel: string;
  type: string | PmfmType;
  minValue: number;
  maxValue: number;
  defaultValue: PmfmValue;
  maximumNumberDecimals: number;
  signifFiguresNumber: number;
  isMandatory: boolean;
  acquisitionNumber: number;
  rankOrder: number;
  acquisitionLevel: string;

  parameterId: number;
  matrixId: number;
  fractionId: number;
  methodId: number;

  gearIds: number[];
  taxonGroupIds: number[];
  referenceTaxonIds: number[];

  qualitativeValues: ReferentialRef[];

  strategyId: number;
  hidden?: boolean;

  constructor() {
    super(DenormalizedPmfmStrategy.TYPENAME);
  }

  asObject(options?: EntityAsObjectOptions): any {
    const target: any = super.asObject(options);
    target.qualitativeValues = this.qualitativeValues && this.qualitativeValues.map(qv => qv.asObject(options)) || undefined;
    target.defaultValue = +(PmfmValueUtils.toModelValue(this.defaultValue, this));
    return target;
  }

  fromObject(source: any, opts?: any) {
    super.fromObject(source, opts);
    this.parameterId =  source.parameterId;
    this.matrixId = source.matrixId;
    this.fractionId = source.fractionId;
    this.methodId = source.methodId;
    this.label = source.label;
    this.name = source.name;
    this.completeName = source.completeName;
    this.unitLabel = source.unitLabel;
    this.type = source.type;
    this.minValue = source.minValue;
    this.maxValue = source.maxValue;
    this.maximumNumberDecimals = source.maximumNumberDecimals;
    this.defaultValue = source.defaultValue;
    this.acquisitionNumber = source.acquisitionNumber;
    this.signifFiguresNumber = source.signifFiguresNumber;
    this.isMandatory = source.isMandatory;
    this.rankOrder = source.rankOrder;
    this.acquisitionLevel = source.acquisitionLevel;
    this.gearIds = source.gearIds && [...source.gearIds] || undefined;
    this.taxonGroupIds = source.taxonGroupIds && [...source.taxonGroupIds] || undefined;
    this.referenceTaxonIds = source.referenceTaxonIds && [...source.referenceTaxonIds] || undefined;
    this.qualitativeValues = source.qualitativeValues && source.qualitativeValues.map(ReferentialRef.fromObject);
    this.strategyId = source.strategyId;
  }

  get required(): boolean {
    return this.isMandatory;
  }

  set required(value: boolean) {
    this.isMandatory = value;
  }

  get isNumeric(): boolean {
    return this.type === 'integer' || this.type === 'double';
  }

  get isAlphanumeric(): boolean {
    return this.type === 'string';
  }

  get isDate(): boolean {
    return this.type === 'date';
  }

  get isComputed(): boolean {
    return this.type && (this.methodId === MethodIds.CALCULATED);
  }

  get isQualitative(): boolean {
    return this.type === 'qualitative_value';
  }

  get hasUnit(): boolean {
    return this.unitLabel && this.isNumeric;
  }

  get isWeight(): boolean {
    return PmfmUtils.isWeight(this);
  }

  /**
   * @deprecated Use id instead
   */
  get pmfmId(): number {
    return this.id;
  }

  equals(other: DenormalizedPmfmStrategy): boolean {
    return other && (this.id === other.id
      // Same strategy, acquisitionLevel, pmfmId
      || (this.strategyId === other.strategyId && this.acquisitionLevel === other.acquisitionLevel)
    );
  }
}
