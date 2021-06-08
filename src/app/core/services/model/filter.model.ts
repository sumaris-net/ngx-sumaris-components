import {isEmptyArray, isNotEmptyArray, isNotNilOrBlank} from '../../../shared/functions';
import {ReferentialUtils} from './referential.model';
import {Entity, EntityAsObjectOptions, IEntity, isInstanceOf} from './entity.model';
import {FilterFn} from '../../../shared/services/entity-service.class';


export const MINIFY_FOR_POD_OPTIONS = Object.freeze(<EntityAsObjectOptions>{
  minify: true,
  keepTypename: false,
  keepLocalId: false
});

export interface IEntityFilter<
  F extends IEntityFilter<F, T, ID, AO, FO>,
  T extends IEntity<T, ID>,
  ID = number,
  AO extends EntityAsObjectOptions = EntityAsObjectOptions,
  FO = any
  > extends IEntity<F, number /*filter ID*/, AO, FO> {

  asPodObject(): any;
  asFilterFn(): FilterFn<T>;
  isEmpty(): boolean;
  countNotEmptyCriteria(): number;
}

export abstract class EntityFilter<
  F extends EntityFilter<F, T, ID, AO, FO>,
  T extends IEntity<T, ID>,
  ID = number,
  AO extends EntityAsObjectOptions = EntityAsObjectOptions,
  FO = any
  >
  extends Entity<F, number, AO, FO>
  implements IEntityFilter<F, T, ID, AO, FO>{

  /**
   * Clean a filter, before sending to the pod (e.g convert dates, remove internal properties, etc.)
   */
  asPodObject(): any {
    return this.asObject(MINIFY_FOR_POD_OPTIONS as AO);
  }

  isEmpty(): boolean {
    const json = this.asPodObject();
    return Object.keys(json)
      .map(key => json[key])
      .findIndex(value => isNotNilOrBlank(value) || isNotEmptyArray(value) || ReferentialUtils.isNotEmpty(value)) !== -1;
  }

  countNotEmptyCriteria(): number {
    const json = this.asPodObject();
    return Object.keys(json)
      .map(key => json[key])
      .filter(value => isNotNilOrBlank(value) || ReferentialUtils.isNotEmpty(value))
      .length;
  }

  protected buildFilter(): FilterFn<T>[] {
     // Can be completed by subclasses
    return [];
  }

  asFilterFn(): FilterFn<T> {
    const filterFns = this.buildFilter();

    if (isEmptyArray(filterFns)) return undefined;

    return (entity) => !filterFns.find(fn => !fn(entity));
  }
}

export abstract class EntityFilterUtils {

  static isEntityFilter<F extends EntityFilter<F, any>>(obj: Partial<F>): obj is F {
    return obj && obj.asPodObject && obj.asFilterFn && true || false;
  }

  static fromObject<F>(source: any, filterType: new () => F): F {
    if (!source) return source;
    if (isInstanceOf(source, filterType)) return source as F;
    const target = new filterType();
    if (EntityFilterUtils.isEntityFilter(target)) {
      target.fromObject(source);
    }
    else {
      Object.assign(target, source);
    }
    return target;
  }
}
