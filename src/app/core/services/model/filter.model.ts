import {isEmptyArray, isNil} from '../../../shared/functions';
import {MINIFY_ENTITY_FOR_POD, ReferentialUtils} from './referential.model';
import {Entity, EntityAsObjectOptions, IEntity, isInstanceOf} from './entity.model';
import {FilterFn} from '../../../shared/services/entity-service.class';
import {StoreObject} from '@apollo/client/core';



export interface IEntityFilter<F extends IEntityFilter<F, T, ID, AO, FO>,
  T extends IEntity<T, ID>,
  ID = number,
  AO extends EntityAsObjectOptions = EntityAsObjectOptions,
  FO = any> extends IEntity<F, number /*filter ID*/, AO, FO> {

  asPodObject(): any;

  asFilterFn(): FilterFn<T>;

  isEmpty(): boolean;

  countNotEmptyCriteria(): number;
}

export abstract class EntityFilter<F extends EntityFilter<F, T, ID, AO, FO>,
  T extends IEntity<T, ID>,
  ID = number,
  AO extends EntityAsObjectOptions = EntityAsObjectOptions,
  FO = any>
  extends Entity<F, number, AO, FO>
  implements IEntityFilter<F, T, ID, AO, FO> {

  constructor(__typename?: string) {
    super(__typename);
  }

  /**
   * Clean a filter, before sending to the pod (e.g convert dates, remove internal properties, etc.)
   */
  asPodObject(): any {
    return this.asObject(MINIFY_ENTITY_FOR_POD as AO);
  }

  isEmpty(): boolean {
    return this.countNotEmptyCriteria() === 0;
  }

  countNotEmptyCriteria(): number {
    const json = this.asPodObject();
    return Object.keys(json)
      .filter(key => this.isCriteriaNotEmpty(key, json[key]))
      .length;
  }

  asFilterFn(): FilterFn<T> {
    const filterFns = this.buildFilter();
    if (isEmptyArray(filterFns)) return undefined;
    return (entity) => !filterFns.find(fn => !fn(entity));
  }

  protected buildFilter(): FilterFn<T>[] {
    // Can be completed by subclasses
    return [];
  }

  protected isCriteriaNotEmpty(key: string, value: any): boolean {
    // Can be overridden by subclasses
    return value !== undefined && value !== null &&
      (
        // not empty string
        (typeof value === 'string' && value.trim() !== '') ||
        // valid number
        (typeof value === 'number' && !isNaN(value)) ||
        // valid boolean
        (typeof value === 'boolean') ||
        // not empty array
        (value.length > 0) ||
        // entity with an id
        ReferentialUtils.isNotEmpty(value)
      );
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
    } else {
      Object.assign(target, source);
    }
    return target;
  }
}
