import {Moment} from 'moment';
import {joinPropertiesPath} from '../../../shared/functions';
import {Entity, EntityAsObjectOptions, EntityUtils, IEntity} from './entity.model';
import {StatusIds} from './model.enum';
import {fromDateISOString, toDateISOString} from '../../../shared/dates';
import {EntityClass} from './entity.decorators';

export function referentialToString(obj: Referential | any, properties?: string[]): string | undefined {
  return obj && obj.id && joinPropertiesPath(obj, properties || ['label', 'name']) || undefined;
}
export function referentialsToString(values: Referential[], properties?: string[], separator?: string): string {
  return (values || []).map(v => referentialToString(v, properties)).join(separator || ', ');
}

export declare interface StatusValue {
  id: number;
  icon: string;
  label: string;
}

export const DefaultStatusList: StatusValue[] = [
  {
    id: StatusIds.ENABLE,
    icon: 'checkmark',
    label: 'REFERENTIAL.STATUS_ENUM.ENABLE'
  },
  {
    id: StatusIds.DISABLE,
    icon: 'close',
    label: 'REFERENTIAL.STATUS_ENUM.DISABLE'
  },
  {
    id: StatusIds.TEMPORARY,
    icon: 'help',
    label: 'REFERENTIAL.STATUS_ENUM.TEMPORARY'
  }
];

//@dynamic
export abstract class BaseReferential<
  T extends BaseReferential<any, ID, O>,
  ID = number,
  O extends ReferentialAsObjectOptions = ReferentialAsObjectOptions,
  FO = any
  >
  extends Entity<T, ID, O, FO>
  implements IReferentialRef<T, ID> {

  label: string = null;
  name: string = null;
  description: string = null;
  comments: string = null;
  creationDate: Date | Moment = null;
  statusId: number = null;
  validityStatusId: number = null;
  levelId: number = null;
  parentId: number = null;
  entityName: string = null;

  constructor(__typename?: string) {
    super(__typename);
  }

  asObject(opts?: O): any {
    if (opts && opts.minify) {
      return {
        id: this.id,
        entityName: opts.keepEntityName && this.entityName || undefined, // Don't keep by default
        __typename: opts.keepTypename && this.__typename || undefined
      };
    }
    const target: any = super.asObject(opts);
    target.creationDate = toDateISOString(this.creationDate);
    if (opts && opts.keepTypename === false) delete target.entityName;
    return target;
  }

  fromObject(source: any, opts?: FO) {
    super.fromObject(source, opts);
    this.label = source.label;
    this.name = source.name;
    this.description = source.description;
    this.comments = source.comments;
    this.statusId = source.statusId;
    this.validityStatusId  = source.validityStatusId;
    this.levelId = source.levelId && source.levelId !== 0 ? source.levelId : undefined; // Do not set as null (need for account.department, when register)
    this.parentId = source.parentId;
    this.creationDate = fromDateISOString(source.creationDate);
    this.entityName = source.entityName;
  }

  equals(other: T): boolean {
    return super.equals(other) && this.entityName === other.entityName;
  }
}

// @dynamic
@EntityClass({typename: 'ReferentialVO'})
export class Referential extends BaseReferential<Referential> {
  static fromObject: (source: any, opts?: any) => Referential;
}

export class ReferentialUtils {
  // FIXME: remove this
  static fromObject(source: any): Referential {
    if (!source || source instanceof Referential) return source;
    const res = new Referential();
    res.fromObject(source);
    return res as Referential;
  }

  static isNotEmpty<T extends BaseReferential<any> | ReferentialRef>(obj: T|any): boolean {
    // A referential entity should always have a 'id' filled (can be negative is local and temporary)
    return EntityUtils.isNotEmpty(obj, 'id');
  }

  static isNotEmptyReferential<T extends BaseReferential<any> | ReferentialRef>(obj: T|any): obj is T {
    return EntityUtils.isNotEmpty(obj, 'id');
  }

  static isEmpty<T extends BaseReferential<any> | ReferentialRef>(obj: T|any): boolean {
    return EntityUtils.isEmpty(obj, 'id');
  }

  static equals<T extends BaseReferential<any> | ReferentialRef>(o1: T|any, o2: T|any): boolean {
    return EntityUtils.equals(o1, o2, 'id');
  }

}

export declare interface IReferentialRef<
  T extends IEntity<T, ID> = IEntity<any, any>,
  ID = number
  >
  extends IEntity<T, ID> {
  label: string;
  name: string;
  levelId?: number;
  statusId: number;
  entityName: string;
}

export interface ReferentialAsObjectOptions extends EntityAsObjectOptions {
  keepEntityName?: boolean;
}

export const NOT_MINIFY_OPTIONS: ReferentialAsObjectOptions = {minify: false};

export const MINIFY_OPTIONS: ReferentialAsObjectOptions = {minify: true};

export const SAVE_LOCALLY_AS_OBJECT_OPTIONS: ReferentialAsObjectOptions = {
  minify: true,
  keepTypename: true,
  keepEntityName: true,
  keepLocalId: true
};

export const SAVE_AS_OBJECT_OPTIONS: ReferentialAsObjectOptions = {
  minify: true,
  keepTypename: false,
  keepEntityName: false,
  keepLocalId: false
};

// @dynamic
@EntityClass({typename: 'ReferentialVO'})
export class ReferentialRef<
  T extends ReferentialRef<any, ID> = ReferentialRef<any, any>,
  ID = number,
  O extends ReferentialAsObjectOptions = ReferentialAsObjectOptions,
  FO = any
  >
  extends Entity<T, ID, O, FO>
  implements IReferentialRef<T, ID> {

  static fromObject: (source: any, opts?: any) => ReferentialRef;

  label: string = null;
  name: string = null;
  statusId: number = null;
  levelId: number = null;
  entityName: string = null;

  constructor() {
    super(ReferentialRef.TYPENAME);
  }

  asObject(opts?: O): any {
    if (opts && opts.minify) {
      return {
        id: this.id,
        entityName: opts.keepEntityName && this.entityName || undefined, // Don't keep by default
        __typename: opts.keepTypename && this.__typename || undefined
      };
    }
    const target: any = super.asObject(opts);
    if (opts && opts.keepEntityName === false) delete target.entityName;

    return target;
  }

  fromObject(source: any, opts?: FO) {
    super.fromObject(source);
    this.entityName = source.entityName || this.entityName;
    this.label = source.label;
    this.name = source.name;
    this.statusId = source.statusId;
    this.levelId = source.levelId;
  }
}
