import { Injectable } from "@angular/core";
import gql from "graphql-tag";
import { Apollo } from "apollo-angular";
import { Observable, Subject } from "rxjs-compat";
import { Person, Operation, Referential, DataEntity, VesselPosition, Measurement } from "./model";
import { DataService, BaseDataService } from "../../core/services/data-service.class";
import { map } from "rxjs/operators";
import { Moment } from "moment";
import { TripService } from "./trip-service";

import { ErrorCodes } from "./errors";
import { AccountService } from "../../core/services/account.service";

export declare class OperationFilter {
  tripId?: number;
}
const LoadAllQuery: any = gql`
  query Operations($filter: OperationFilterVOInput, $offset: Int, $size: Int, $sortBy: String, $sortDirection: String){
    operations(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      metier {
        id
        label
        name
        entityName
      }
      recorderDepartment {
        id
        label
        name
      }
      positions {
        id
        dateTime
        latitude
        longitude
        updateDate
        recorderDepartment {
          id
          label
          name
        }
      }
    }
  }
`;
const LoadQuery: any = gql`
  query Operation($id: Int) {
    operation(id: $id) {
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      metier {
        id
        label
        name
        entityName
      }
      recorderDepartment {
        id
        label
        name
      }
      positions {
        id
        dateTime
        latitude
        longitude
        updateDate
        recorderDepartment {
          id
          label
          name
        }
      }
      measurements {
        id
        pmfmId
        alphanumericalValue
        numericalValue
        qualitativeValue {
          id
        }
        digitCount
        rankOrder
        creationDate
        updateDate
        recorderDepartment {
          id
          label
          name
        }
      }
    }  
  }
`;
const SaveOperations: any = gql`
  mutation saveOperations($operations:[OperationVOInput]){
    saveOperations(operations: $operations){
      id
      startDateTime
      endDateTime
      fishingStartDateTime
      fishingEndDateTime
      rankOrderOnPeriod      
      physicalGearId
      tripId
      comments
      hasCatch
      updateDate
      recorderDepartment {
        id
        label
        name
      }
      positions {
        id
        dateTime
        latitude
        longitude
        updateDate
        recorderDepartment {
          id
          label
          name
        }
      }
      measurements {
        id
        pmfmId
        alphanumericalValue
        numericalValue
        qualitativeValue {
          id
        }
        digitCount
        rankOrder
        creationDate
        updateDate
        recorderDepartment {
          id
          label
          name
        }
      }
    }
  }
`;
const DeleteOperations: any = gql`
  mutation deleteOperations($ids:[Int]){
    deleteOperations(ids: $ids)
  }
`;

const sortByStartDateFn = (n1: Operation, n2: Operation) => { return n1.startDateTime.isSame(n2.startDateTime) ? 0 : (n1.startDateTime.isAfter(n2.startDateTime) ? -1 : 1); };
const sortByRankrOrderFn = (n1: Operation, n2: Operation) => { return n1.rankOrderOnPeriod - n2.rankOrderOnPeriod; };

@Injectable()
export class OperationService extends BaseDataService implements DataService<Operation, OperationFilter>{

  constructor(
    protected apollo: Apollo,
    protected accountService: AccountService,
    protected tripService: TripService
  ) {
    super(apollo);
  }

  /**
   * Load many operations
   * @param offset 
   * @param size 
   * @param sortBy 
   * @param sortDirection 
   * @param filter 
   */
  loadAll(offset: number,
    size: number,
    sortBy?: string,
    sortDirection?: string,
    filter?: OperationFilter): Observable<Operation[]> {
    const variables: any = {
      offset: offset || 0,
      size: size || 1000,
      sortBy: sortBy || 'startDateTime',
      sortDirection: sortDirection || 'asc',
      filter: filter
    };

    this._lastVariables.loadAll = variables;

    console.debug("[operation-service] Loading operations... using options:", variables);
    return this.watchQuery<{ operations: Operation[] }>({
      query: LoadAllQuery,
      variables: variables,
      error: { code: ErrorCodes.LOAD_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.LOAD_OPERATIONS_ERROR" }
    })
      .pipe(
        map((data) => {
          console.debug("[operation-service] Loaded {" + (data && data.operations && data.operations.length || 0) + "} operations");
          const res = (data && data.operations || []).map(t => {
            const res = new Operation();
            res.fromObject(t);
            return res;
          });

          // Compute rankOrderOnPeriod, by tripId
          if (filter && filter.tripId) {
            let rankOrderOnPeriod = 1;
            res.sort(sortByStartDateFn).forEach(o => o.rankOrderOnPeriod = rankOrderOnPeriod++);
          }

          return res;
        }));
  }

  load(id: number): Observable<Operation | null> {
    console.debug("[operation-service] Loading operation {" + id + "}...");

    return this.watchQuery<{ operation: Operation }>({
      query: LoadQuery,
      variables: {
        id: id
      },
      error: { code: ErrorCodes.LOAD_OPERATION_ERROR, message: "TRIP.OPERATION.ERROR.LOAD_OPERATION_ERROR" }
    })
      .map(data => {
        if (data && data.operation) {
          console.debug("[operation-service] Loaded operation {" + id + "}");
          return Operation.fromObject(data.operation);
        }
        return null;
      });
  }

  /**
   * Save many operations
   * @param data 
   */
  async saveAll(entities: Operation[], options?: any): Promise<Operation[]> {
    if (!entities) return entities;

    if (!options || !options.tripId) {
      console.error("[operation-service] Missing options.tripId");
      throw { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATIONS_ERROR" };
    }

    // Compute rankOrderOnPeriod
    let rankOrderOnPeriod = 1;
    entities.sort(sortByStartDateFn).forEach(o => o.rankOrderOnPeriod = rankOrderOnPeriod++);

    const json = entities.map(t => {
      // Fill default properties (as recorder department and person)
      this.fillDefaultProperties(t, options);
      return t.asObject();
    });

    console.debug("[operation-service] Saving operations: ", json);

    const res = await this.mutate<{ saveOperations: Operation[] }>({
      mutation: SaveOperations,
      variables: {
        operations: json
      },
      error: { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATIONS_ERROR" }
    });

    // Copy id and update date
    (res && res.saveOperations && entities || [])
      .forEach(entity => {
        const savedOperation = res.saveOperations.find(res => entity.equals(res));
        this.copyIdAndUpdateDate(savedOperation, entity);
      });

    return entities;
  }

  /**
     * Save an operation
     * @param data 
     */
  async save(entity: Operation): Promise<Operation> {


    // Fill default properties (as recorder department and person)
    this.fillDefaultProperties(entity, {});

    // Transform into json
    const json = entity.asObject();
    const isNew = !entity.id;

    console.debug("[operation-service] Saving operation: ", json);

    const res = await this.mutate<{ saveOperations: Operation[] }>({
      mutation: SaveOperations,
      variables: {
        operations: [json]
      },
      error: { code: ErrorCodes.SAVE_OPERATIONS_ERROR, message: "TRIP.OPERATION.ERROR.SAVE_OPERATION_ERROR" }
    });

    const savedOperation = res && res.saveOperations && res.saveOperations[0];
    if (savedOperation) {
      // Copy id and update Date
      this.copyIdAndUpdateDate(savedOperation, entity);

      // Update the cache
      if (isNew && this._lastVariables.loadAll) {
        const list = this.addToQueryCache({
          query: LoadAllQuery,
          variables: this._lastVariables.loadAll
        }, 'operations', savedOperation);
      }
    }

    return entity;
  }

  /**
   * Save many operations
   * @param entities 
   */
  deleteAll(entities: Operation[]): Promise<any> {

    let ids = entities && entities
      .map(t => t.id)
      .filter(id => (id > 0));

    console.debug("[operation-service] Deleting operations... ids:", ids);

    return this.mutate<any>({
      mutation: DeleteOperations,
      variables: {
        ids: ids
      }
    });
  }

  /* -- protected methods -- */

  protected fillDefaultProperties(entity: Operation, options?: any) {

    // Fill Recorder department
    this.fillRecorderPartment(entity);
    this.fillRecorderPartment(entity.startPosition)
    this.fillRecorderPartment(entity.endPosition)
    entity.measurements && entity.measurements.forEach(m => this.fillRecorderPartment(m));

    // Fill position date s
    entity.startPosition.dateTime = entity.fishingStartDateTime || entity.startDateTime;
    entity.endPosition.dateTime = entity.fishingEndDateTime || entity.endDateTime;

    // Fill trip ID
    if (!entity.tripId && options) {
      entity.tripId = options.tripId;
    }
  }

  fillRecorderPartment(entity: DataEntity<Operation | VesselPosition | Measurement>) {
    if (!entity.recorderDepartment || !entity.recorderDepartment.id) {

      const person: Person = this.accountService.account;

      // Recorder department
      if (person && person.department) {
        entity.recorderDepartment.id = person.department.id;
      }
    }
  }

  copyIdAndUpdateDate(source: Operation | undefined, target: Operation) {
    if (source) {

      // Update (id and updateDate)
      target.id = source.id || target.id;
      target.updateDate = source.updateDate || target.updateDate;
      target.dirty = false;

      // Update positions (id and updateDate)
      if (source.positions && source.positions.length > 0) {
        [target.startPosition, target.endPosition].forEach(targetPos => {
          let savedPos = source.positions.find(srcPos => targetPos.equals(srcPos));
          if (savedPos) {
            targetPos.id = savedPos.id || targetPos.id;
            targetPos.updateDate = savedPos.updateDate || targetPos.updateDate;
            targetPos.dirty = false;
          }
        });
      }
    }
  }
}