import {BehaviorSubject, Observable} from 'rxjs';
import {Storage} from '@ionic/storage';
import {map, mergeMap} from 'rxjs/operators';
import {Entity, EntityUtils, IEntity} from '../model/entity.model';
import {isEmptyArray, isNil, isNotEmptyArray, isNotNil} from '../../../shared/functions';
import {IEntitiesService, LoadResult} from '../../../shared/services/entity-service.class';
import {chainPromises} from '../../../shared/observables';
import {ErrorCodes} from '../errors';

export const ENTITIES_STORAGE_KEY_PREFIX = 'entities';

export type EntityStoreTypePolicyMode = 'default' | 'by-id';

export declare interface EntityStoreTypePolicy<T extends Entity<T, any> = Entity<any, any>, K = keyof T>  {
  mode?: EntityStoreTypePolicyMode; // 'default' by default
  skipNonLocalEntities?: boolean; // False by default
  lightFieldsExcludes?: K[]; // none by default
}

export declare interface EntityStorageLoadOptions {
  fullLoad?: boolean;
}

declare interface EntityStatus {
  index: number;
  dirty?: boolean;
}

export class EntityStore<
  T extends IEntity<T, ID>,
  ID = number,
  O extends EntityStorageLoadOptions = EntityStorageLoadOptions> {

  private readonly _storageKey: string;
  private readonly _onChange = new BehaviorSubject(true);
  private readonly _mapToLightEntity: (T) => T;
  private _cache: T[];
  private _statusById: Map<ID, EntityStatus>;
  private _sequence: number;
  private _dirty = false;
  private _loaded: boolean;

  readonly policy: EntityStoreTypePolicy<T>;

  get cache(): T[] {
    return this._cache;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  protected get isByIdMode(): boolean {
    return this.policy.mode === 'by-id';
  }

  protected get storageKeyById(): string {
    return this._storageKey + '#ids';
  }

  constructor(
    protected readonly name: string,
    protected readonly storage: Storage,
    policy?: EntityStoreTypePolicy<T>) {
    this.policy = policy || {};
    this.reset({emitEvent: false});
    this._dirty = false;
    this._loaded = false;
    this._storageKey = ENTITIES_STORAGE_KEY_PREFIX + '#' + name;
    this._mapToLightEntity = this.createLightEntityMapFn(this.policy);
  }

  nextValue(): ID {
    this._sequence = this._sequence - 1;
    this._dirty = true;
    return this._sequence as unknown as ID;
  }

  currentValue(): number {
    return this._sequence;
  }

  async load(id: ID, opts?: EntityStorageLoadOptions): Promise<T> {
    if (this._mapToLightEntity && (!opts || opts.fullLoad !== false)) {
      return await this.loadFullEntity(id, opts);
    }
    return this.loadCachedEntity(id, opts);
  }

  /**
   * Watch a set of entities
   *
   * @param variables
   * @param opts
   */
  watchAll(variables: {
            offset?: number;
            size?: number;
            sortBy?: string;
            sortDirection?: string;
            filter?: (T) => boolean;
          }, opts?: O): Observable<LoadResult<T>> {

    // If need full entities, but use light entities in the entities array
    if (this._mapToLightEntity && (opts && opts.fullLoad === true)) {
      console.warn('[entity-store] WARN: Watching full entities, splited by id in entity store. This can be long! Please make sure you need full entities here.');
      return this._onChange
        .pipe(
          // Apply filter on cache
          map((_) => this.reduceAndSort(this._cache, variables)),

          // Then convert into full entities (using parallel jobs - /!\ can use lot of memory)
          mergeMap((res) => Promise.all((res.data || [])
            .map(e => this.loadFullEntity(e.id, opts))).then(data => ({
                data,
                total: res.total
              }))
          )
        );
    }

    // Load using entities array
    return this._onChange
      .pipe(
        map((_) => this.reduceAndSort(this._cache, variables))
      );
  }

  /**
   * WIll apply a filter, then a sort, then a page slice
   *
   * @param variables
   * @param opts
   */
  async loadAll(variables: {
    offset?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: string;
    filter?: (T) => boolean;
  }, opts?: O): Promise<LoadResult<T>> {

    const res = this.reduceAndSort(this._cache, variables);

    // If store by ID: make sure to full the full entities
    if (this._mapToLightEntity && isNotEmptyArray(res.data) && (opts && opts.fullLoad === true)) {
      // Load full entities, one by one
      res.data = await chainPromises((res.data || []).map(e => () => this.load(e.id)));
    }

    return res ;
  }

  save(entity: T, opts?: {emitEvent?: boolean}): T {
    const status = isNotNil(entity.id) && this._statusById.get(entity.id) || {index: undefined};
    const isNew = isNil(status.index);
    if (isNew) {
      if (isNil(entity.id)) {
        entity.id = this.nextValue();
      }
      else if (+entity.id < 0 && +entity.id > this._sequence) {
        console.warn('Trying to save a local entity with an id > sequence. Will replace id by sequence next value');
        entity.id = this.nextValue();
      }
      else {
        // OK: use a valid id :
        // - id >= 0 (should be a remote id)
        // - OR < sequence, and not exists in the index map
      }

      this._statusById.set(entity.id, status);
      status.index = this._cache.push(entity) - 1;
    }
    else {
      this._cache[status.index] = entity;
    }

    // Mark entity as dirty
    status.dirty = true;

    // Mark storage as dirty
    this._dirty = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }

    return entity;
  }

  saveAll(entities: T[], opts?: { emitEvent?: boolean; reset?: boolean }): T[] {
    if (isEmptyArray(entities) && (!opts || opts.reset !== true)) return entities; // Skip (Nothing to save)

    let result: T[];

    console.info(`[entity-storage] Saving ${entities.length} ${this.name}(s)`);

    // First save, or reset using given entities
    if (isEmptyArray(this._cache) || (opts && opts.reset)) {
      this.setEntities(entities, {emitEvent: false});
    }
    else {
      result = entities.map((entity) => this.save(entity, {emitEvent: false}));
    }

    // Mark as dirty
    this._dirty = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }

    return result || this._cache.slice();
  }

  delete(id: ID, opts?: { emitEvent?: boolean }): T | undefined {
    const status = isNotNil(id) ? this._statusById.get(id) : undefined;
    const index = status ? status.index : undefined;
    if (isNil(index)) return undefined;

    const entity = this._cache[index];
    if (!entity) return undefined;

    // Remove from cache
    this._cache[index] = undefined;
    this._statusById.delete(entity.id);

    // Remove full entity, by id
    if (this.isByIdMode) {
      this.storage.remove(this._storageKey + '#' + id);
    }

    // Mark as dirty
    this._dirty = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }

    return entity as T;
  }

  deleteMany(ids: ID[], opts?: {emitEvent?: boolean}): T[] {

    // Delete by id, but NOT emit event on each deletion
    const deletedEntities = (ids || [])
      .map(id => this.delete(id, {emitEvent: false}))
      .filter(isNotNil);

    // No changes: exit
    if (!deletedEntities.length) return [];

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }

    return deletedEntities;
  }

  reset(opts?: {emitEvent?: boolean}) {
    this._cache = [];
    this._sequence = 0;
    this._statusById = new Map<ID, any>();

    this._dirty = true;
    this._loaded = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }
  }

  /**
   *
   * @param opts
   *  opts.force : force all entities to be persist, and not only if dirty
   */
  async persist(opts?: { skipIfPristine?: boolean }): Promise<number> {
    opts = {
      skipIfPristine: true,
      ...opts
    };

    // Skip is not dirty
    if (opts.skipIfPristine && !this._dirty) {
      console.debug(`[entity-storage] Persisting ${this.name} not need. Skip`);
      return this._cache.length;
    }

    // Copy some data, BEFORE to call markAsPristine() to allow parallel changes
    const dirtyIndexes = this.isByIdMode && Object.values(this._statusById)
      .filter(s => !opts.skipIfPristine || (s && s.dirty))
      .map(s => s.index);
    const entities = this._cache.slice(); // Copy cached entities

    // Mark all (entities and status) as pristine
    this.markAsPristine({emitEvent: false});

    // Convert dirty entities into light entities (/!\ AFTER the previous copy)
    // and update the cache (but NOT the 'entities' variable)
    if (dirtyIndexes && this._mapToLightEntity) {
      dirtyIndexes.forEach(index => this._cache[index] = this._mapToLightEntity(entities[index]));
    }

    // If no entity found
    if (isEmptyArray(entities)) {

      // Clean the local storage
      await this.storage.remove(this._storageKey);
    }
    else {

      // Save each entity into a unique key (advanced mode)
      if (this.isByIdMode) {
        // Save ids
        await this.storage.set(this.storageKeyById, entities.filter(isNotNil).map(e => e.id));

        // Saved dirty entities
        await Promise.all(
          dirtyIndexes
            .map(index => {
              const entity = entities[index];
              console.debug(`[entity-storage] Persisting ${this.name}#${entity.id}...`);
              return this.storage.set(this._storageKey + '#' + entity.id, entity);
            }));

        console.info(`[entity-storage] Persisting ${dirtyIndexes.length}/${entities.length} ${this.name}(s)...`);
      }

      // Save all entities in a single key (default)
      else {

        console.info(`[entity-storage] Persisting ${entities.length} ${this.name}(s)...`);
        await this.storage.set(this._storageKey, entities);
      }
    }

    return entities.length;
  }

  async restore(opts?: { emitEvent?: boolean }): Promise<number> {
    let entities: T[];

    const res = await Promise.all([
      this.storage.get(this._storageKey),
      this.storage.get(this.storageKeyById)
    ]);
    const values = res[0] && res[0] instanceof Array ? res[0] : null;
    const ids = res[1] && res[1] instanceof Array ? res[1] : null;
    let migration = false;
    let oldKeysToClean: string[];

    // "Split by id" mode
    if (this.isByIdMode) {
      if (isNotNil(ids)) {
        // Load entity by id (one by one)
        const storageKeys = ids.map(id => this._storageKey + '#' + id);
        entities = await chainPromises<T>(storageKeys.map(key => () => this.storage.get(key)));
      }
      // Migrate from the standard mode
      else if (isNotNil(values)) {
        entities = values.filter(e => e && isNotNil(e.id));
        migration = true;
        oldKeysToClean = [this._storageKey];
      }
    }

    // Else (default mode)
    else {
      if (isNotNil(values)) {
        entities = values.filter(e => e && isNotNil(e.id));
      }
      else if (isNotNil(ids)) {
        const storageKeys = ids.map(id => this._storageKey + '#' + id);
        // Load entity by id (one by one)
        entities = await chainPromises<T>(storageKeys.map(key => () => this.storage.get(key)));
        migration = true;
        oldKeysToClean = [...storageKeys, this.storageKeyById];
      }
    }

    // OK, there is something in storage...
    if (isNotEmptyArray(entities)) {
      if (entities.length >= 1000) {
        console.warn(`[entity-storage] - Restoring ${entities.length} ${this.name}. Check if not too many elements?!`);
      }

      // Map entities into light element (if if not need to persist, because of migration
      if (this._mapToLightEntity && !migration) {
        entities = entities.map(this._mapToLightEntity);
      }
    }

    this.setEntities(entities || [], {...opts, emitEvent: false });
    this._dirty = false;

    // Finish the migration
    if (migration) {
      try {
        console.warn(`[entity-storage] - Migrate ${this.name} into {mode: '${this.policy.mode}'}...`);

        // Force to persist, using the new mode
        await this.persist({skipIfPristine: false /* force persist using the new mode */ });

        // Clean old storage keys (one by one)
        if (isNotEmptyArray(oldKeysToClean)) await chainPromises(oldKeysToClean.map(key => () => this.storage.remove(key)));
      }
      catch (err) {
        console.error(err);
        throw {code: ErrorCodes.ENTITY_STORAGE_MIGRATION_FAILED, message: 'ERROR.ENTITY_STORAGE_MIGRATION_FAILED', details: err};
      }
    }

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }

    return this._cache.length;
  }

  markAsDirty(opts?: { emitEvent?: boolean }) {
    this._dirty = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }
  }

  markAsPristine(opts?: { emitEvent?: boolean }) {

    for (const s of this._statusById.values()) {
      if (isNotNil(s)) {
        s.dirty = false;
      }
    }
    this._dirty = false;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }
  }

  /* -- protected methods -- */

  private loadCachedEntity(id: ID, opts?: EntityStorageLoadOptions): T {
    const status = this._statusById.get(id);
    const index = status && status.index;
    if (isNil(index)) return undefined; // not exists
    return Object.freeze(this._cache[index]);
  }

  private async loadFullEntity(id: ID, opts?: EntityStorageLoadOptions): Promise<T> {
    const status = this._statusById.get(id);
    const index = status && status.index;
    if (isNil(index)) return undefined; // not exists

    // Reload from storage, if need (e.g. some attributes has been excluded in light elements)
    if (status.dirty === false) {
      console.debug(`[entity-storage] Full reloading ${this.name}#${id}...`);
      const fullData = await this.storage.get(this._storageKey + '#' + id);
      if (fullData) return fullData;
      // Not found by id, continue from cache (version prior to 1.5.3)
    }

    // Load from the cache, if dirty OR if storage is not splited by id
    return this._cache[index];
  }

  private setEntities(entities: T[], opts?: {emitEvent?: boolean }) {
    // Filter non nil (and if need non local) entities
    entities = (entities || [])
        .filter(item => isNotNil(item)
          && (!this.policy.skipNonLocalEntities || +item.id < 0)
        );

    this._cache = entities;

    // Update the sequence with min(id) of all temporary ids
    this._sequence = this._cache.reduce((res, item) => +item.id < 0 ? Math.min(res, +item.id) : res, 0);

    this._statusById.clear();
    this._cache.forEach((item, index) => {
      this._statusById.set(item.id, <EntityStatus>{
        index,
        dirty: false
      });
    });

    this._loaded = true;

    // Emit update event
    if (!opts || opts.emitEvent !== false) {
      this.emitEvent();
    }
  }


  /**
   * WIll apply a filter, then a sort, then a page slice
   *
   * @param data
   * @param variables
   */
  private reduceAndSort(data: T[],
                        variables: {
                          offset?: number;
                          size?: number;
                          sortBy?: string;
                          sortDirection?: string;
                          filter?: (T) => boolean;
                        }): LoadResult<T> {
    if (isEmptyArray(data)) {
      return {data: [], total: 0};
    }

    // Remove nil values
    data = data.filter(isNotNil);

    if (!variables) {
      // Return all (but array has been filtered, and copied)
      return {data, total: data.length};
    }

    // Apply the filter, if any
    if (variables.filter) {
      data = data.filter(variables.filter);
    }

    // Compute the total length
    const total = data.length;

    // If page size=0 (e.g. only need total)
    if (variables.size === 0) return {data: [], total};

    // Sort by
    if (data.length && variables.sortBy) {
      EntityUtils.sort(data, variables.sortBy, variables.sortDirection);
    }

    // Slice in a page (using offset and size)
    if (variables.offset > 0) {

      // Offset after the end: no result
      if (variables.offset >= data.length || variables.size === 0) {
        data = [];
      }
      else {
        data = (variables.size > 0 && ((variables.offset + variables.size) < data.length)) ?
          // Slice using limit to size
          data.slice(variables.offset, variables.offset + variables.size) :
          // Slice without limit
          data.slice(variables.offset);
      }
    }

    // Apply a limit
    else if (variables.size > 0){
      data = data.slice(0, variables.size);
    }
    // No limit:
    else if (variables.size === -1){
      // Keep all data
    }

    return {data, total};
  }

  private createLightEntityMapFn(policy: EntityStoreTypePolicy<T>): (T) => T {
    if (policy.mode !== 'by-id') return undefined; // Only need for the 'by-id' mode
    if (isEmptyArray(policy.lightFieldsExcludes)) return undefined; // skip

    // Create a immutable mask object, use to clean some properties
    const excludeAttributesMask = Object.freeze(this.policy.lightFieldsExcludes.reduce((res, attr) => {
      res[attr] = undefined;
      return res;
    }, <T>{}));

    return (entity) => entity ? Object.assign(<T>{}, entity, excludeAttributesMask) : undefined;
  }

  /**
   * Update the entitiesSubject.
   *
   * Before wending items, a filter is apply, to remove null value.
   * This filter will create a array copy.
   */
  private emitEvent() {
    this._onChange.next(true);
  }
}
