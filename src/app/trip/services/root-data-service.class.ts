import {DataEntityAsObjectOptions} from "../../data/services/model/data-entity.model";
import {Directive, Injector} from "@angular/core";
import {BaseEntityService, Department, EntityUtils, isNil, isNotNil} from "../../core/core.module";
import {AccountService} from "../../core/services/account.service";
import {GraphqlService} from "../../core/graphql/graphql.service";
import {IDataEntityQualityService} from "../../data/services/data-quality-service.class";
import {FormErrors} from "../../core/form/form.utils";
import {DataRootEntityUtils, RootDataEntity} from "../../data/services/model/root-data-entity.model";
import {MINIFY_OPTIONS} from "../../core/services/model/referential.model";
import {ErrorCodes} from "./trip.errors";
import {IWithRecorderDepartmentEntity} from "../../data/services/model/model.utils";


export interface RootEntityMutations {
  terminate: any;
  validate: any;
  unvalidate: any;
  qualify: any;
}

@Directive()
// tslint:disable-next-line:directive-class-suffix
export abstract class RootDataService<T extends RootDataEntity<T>, F = any>
  extends BaseEntityService<T, F>
  implements IDataEntityQualityService<T> {

  protected accountService: AccountService;

  protected constructor(
    injector: Injector,
    protected mutations: RootEntityMutations
  ) {
    super(injector.get(GraphqlService));

    this.accountService = this.accountService || injector && injector.get(AccountService) || undefined;
  }

  canUserWrite(entity: T): boolean {
    if (!entity) return false;

    // If the user is the recorder: can write
    if (entity.recorderPerson && this.accountService.account.asPerson().equals(entity.recorderPerson)) {
      return true;
    }

    // TODO: check rights on program (need model changes)
    return this.accountService.canUserWriteDataForDepartment(entity.recorderDepartment);
  }

  abstract control(entity: T, opts?: any): Promise<FormErrors>;

  async terminate(entity: T): Promise<T> {
    if (isNil(entity.id) || entity.id < 0) {
      throw new Error("Entity must be saved before terminate!");
    }

    // Prepare to save
    this.fillDefaultProperties(entity);

    // Transform into json
    const json = this.asObject(entity);

    const now = this._debug && Date.now();
    if (this._debug) console.debug(this._debugPrefix + `Terminate entity {${entity.id}}...`, json);

    await this.graphql.mutate<{ entity: T }>({
      mutation: this.mutations.terminate,
      variables: {
        entity: json
      },
      error: { code: ErrorCodes.TERMINATE_ENTITY_ERROR, message: "ERROR.TERMINATE_ENTITY_ERROR" },
      update: (proxy, {data}) => {
        this.copyIdAndUpdateDate(data && data.entity, entity);
        if (this._debug) console.debug(this._debugPrefix + `Entity terminated in ${Date.now() - now}ms`, entity);
      }
    });

    return entity;
  }


  /**
   * Validate an root entity
   * @param entity
   */
  async validate(entity: T): Promise<T> {

    if (isNil(entity.id) || entity.id < 0) {
      throw new Error("Entity must be saved once before validate !");
    }
    if (isNil(entity.controlDate)) {
      throw new Error("Entity must be controlled before validate !");
    }
    if (isNotNil(entity.validationDate)) {
      throw new Error("Entity is already validated !");
    }

    // Prepare to save
    this.fillDefaultProperties(entity);

    // Transform into json
    const json = this.asObject(entity);

    const now = Date.now();
    if (this._debug) console.debug(this._debugPrefix + `Validate entity {${entity.id}}...`, json);

    await this.graphql.mutate<{ entity: T }>({
      mutation: this.mutations.validate,
      variables: {
        entity: json
      },
      error: { code: ErrorCodes.VALIDATE_ENTITY_ERROR, message: "ERROR.VALIDATE_ENTITY_ERROR" },
      update: (cache, {data}) => {
        this.copyIdAndUpdateDate(data && data.entity, entity);
        if (this._debug) console.debug(this._debugPrefix + `Entity validated in ${Date.now() - now}ms`, entity);
      }
    });

    return entity;
  }

  async unvalidate(entity: T): Promise<T> {

    if (isNil(entity.validationDate)) {
      throw new Error("Entity is not validated yet !");
    }

    // Prepare to save
    this.fillDefaultProperties(entity);

    // Transform into json
    const json = this.asObject(entity);

    const now = Date.now();
    if (this._debug) console.debug(this._debugPrefix + "Unvalidate entity...", json);

    await this.graphql.mutate<{ entity: T }>({
      mutation: this.mutations.unvalidate,
      variables: {
        entity: json
      },
      context: {
        // TODO serializationKey:
        tracked: true
      },
      error: { code: ErrorCodes.UNVALIDATE_ENTITY_ERROR, message: "ERROR.UNVALIDATE_ENTITY_ERROR" },
      update: (proxy, {data}) => {
        const savedEntity = data && data.entity;
        if (savedEntity) {
          if (savedEntity !== entity) {
            this.copyIdAndUpdateDate(savedEntity, entity);
          }

          if (this._debug) console.debug(this._debugPrefix + `Entity unvalidated in ${Date.now() - now}ms`, entity);
        }
      }
    });

    return entity;
  }

  async qualify(entity: T, qualityFlagId: number): Promise<T> {

    if (isNil(entity.validationDate)) {
      throw new Error("Entity is not validated yet !");
    }

    // Prepare to save
    this.fillDefaultProperties(entity);

    // Transform into json
    const json = this.asObject(entity);

    json.qualityFlagId = qualityFlagId;

    const now = Date.now();
    if (this._debug) console.debug(this._debugPrefix + "Qualifying entity...", json);

    await this.graphql.mutate<{ entity: T }>({
      mutation: this.mutations.qualify,
      variables: {
        entity: json
      },
      error: { code: ErrorCodes.QUALIFY_ENTITY_ERROR, message: "ERROR.QUALIFY_ENTITY_ERROR" },
      update: (cache, {data}) => {
        const savedEntity = data && data.entity;
        this.copyIdAndUpdateDate(savedEntity, entity);
        DataRootEntityUtils.copyQualificationDateAndFlag(savedEntity, entity);

        if (this._debug) console.debug(this._debugPrefix + `Entity qualified in ${Date.now() - now}ms`, entity);
      }
    });

    return entity;
  }

  /* -- protected methods -- */


  protected asObject(entity: T, opts?: DataEntityAsObjectOptions): any {
    opts = { ...MINIFY_OPTIONS, ...opts };
    const copy: any = entity.asObject(opts);

    if (opts && opts.minify) {
      // Keep id only, on person and department
      copy.recorderPerson = {id: entity.recorderPerson && entity.recorderPerson.id};
      copy.recorderDepartment = entity.recorderDepartment && {id: entity.recorderDepartment && entity.recorderDepartment.id} || undefined;
    }

    return copy;
  }

  protected fillDefaultProperties(entity: T) {
    // If new entity
    const isNew = isNil(entity.id);
    if (isNew) {

      const person = this.accountService.person;

      // Recorder department
      if (person && person.department && !entity.recorderDepartment) {
        entity.recorderDepartment = person.department;
      }

      // Recorder person
      if (person && person.id && !entity.recorderPerson) {
        entity.recorderPerson = person;
      }
    }
  }

  protected fillRecorderDepartment(entities: IWithRecorderDepartmentEntity<any> | IWithRecorderDepartmentEntity<any>[], department?: Department) {

    if (isNil(entities)) return;
    if (!Array.isArray(entities)) {
      entities = [entities];
    }
    department = department || this.accountService.department;

    entities.forEach(entity => {
      if (!entity.recorderDepartment || !entity.recorderDepartment.id) {
        // Recorder department
        if (department) {
          entity.recorderDepartment = department;
        }
      }
    });
  }

  protected resetQualityProperties(entity: T) {
    entity.controlDate = undefined;
    entity.validationDate = undefined;
    entity.qualificationDate = undefined;
    entity.qualityFlagId = undefined;
  }

  protected copyIdAndUpdateDate(source: T | undefined, target: T) {

    EntityUtils.copyIdAndUpdateDate(source, target);

    // Copy control and validation date
    DataRootEntityUtils.copyControlAndValidationDate(source, target);

  }
}
