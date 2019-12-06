import {Injectable} from "@angular/core";
import gql from "graphql-tag";
import {Observable} from "rxjs";
import {
  Department,
  EntityUtils,
  fromDateISOString,
  isNil,
  isNotNil,
  Person,
  QualityFlagIds,
  Vessel,
  VesselSnapshot
} from "./model";
import {EditorDataService, isNilOrBlank, LoadResult, TableDataService} from "../../shared/shared.module";
import {BaseDataService} from "../../core/core.module";
import {map} from "rxjs/operators";
import {Moment} from "moment";

import {ErrorCodes} from "./errors";
import {AccountService} from "../../core/services/account.service";
import {GraphqlService} from "../../core/services/graphql.service";
import {ReferentialFragments} from "./referential.queries";
import {FetchPolicy} from "apollo-client";
import {isEmptyArray} from "../../shared/functions";
import {EntityAsObjectOptions, MINIFY_OPTIONS} from "../../core/services/model";
import {LoadFeaturesQuery, VesselFeaturesFragments, VesselFeaturesService} from "./vessel-features.service";
import {LoadRegistrationsQuery, RegistrationFragments, VesselRegistrationService} from "./vessel-registration.service";
import {Trip} from "../../trip/services/model/trip.model";

export class VesselFilter {
  date?: Date | Moment;
  vesselId?: number;
  searchText?: string;
  statusId?: number;
  statusIds?: number[];

  static isEmpty(filter: VesselFilter | any): boolean {
    return !filter || (
      !filter.date && isNilOrBlank(filter.vesselId) && isNilOrBlank(filter.searchText) && isNilOrBlank(filter.statusId) && isEmptyArray(filter.statusIds)
    );
  }

  static searchFilter<T extends VesselSnapshot>(f: VesselFilter): (T) => boolean {
    if (this.isEmpty(f)) return undefined; // no filter need
    const searchFilter = EntityUtils.searchTextFilter(['name', 'exteriorMarking', 'registrationCode'], f.searchText);
    return (t: T) => {

      // Vessel id
      if (isNotNil(f.vesselId) && t.id !== f.vesselId) {
        return false;
      }

      // Status
      const statusIds = f.statusIds || (isNotNil(f.statusId) && [f.statusId]);
      if (statusIds && statusIds.find(statusId => statusId === t.vesselStatusId)) {
        return false;
      }

      // Search text
      return isNil(searchFilter) || searchFilter(t);
    };
  }
}

export const VesselFragments = {
  lightVessel: gql`fragment VesselFragment on VesselVO {
      id
      comments
      statusId
      #        qualityFlagId
      #        program
      creationDate
      controlDate
      validationDate
      qualificationDate
      qualificationComments
      updateDate
      comments
      vesselType {
        ...ReferentialFragment
      }
      features {
        ...VesselFeaturesFragment
      }
      registration{
        ...RegistrationFragment
      }
      recorderDepartment {
        ...LightDepartmentFragment
      }
      recorderPerson {
        ...LightPersonFragment
      }
    }`,
    vessel: gql`fragment VesselFragment on VesselVO {
        id
        comments
        statusId
        #        qualityFlagId
        #        program
        creationDate
        controlDate
        validationDate
        qualificationDate
        qualificationComments
        updateDate
        comments
        vesselType {
            ...ReferentialFragment
        }
        features {
            ...VesselFeaturesFragment
        }
        registration{
            ...RegistrationFragment
        }
        recorderDepartment {
            ...LightDepartmentFragment
        }
        recorderPerson {
            ...LightPersonFragment
        }
    }`,
};

const LoadAllQuery: any = gql`
    query Vessels($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: VesselFilterVOInput){
        vessels(offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection, filter: $filter){
            ...VesselFragment
        }
        vesselsCount(filter: $filter)
    }
    ${VesselFragments.vessel}
    ${VesselFeaturesFragments.vesselFeatures}
    ${RegistrationFragments.registration}
    ${ReferentialFragments.location}
    ${ReferentialFragments.lightDepartment}
    ${ReferentialFragments.lightPerson}
    ${ReferentialFragments.referential}
`;
const LoadQuery: any = gql`
    query Vessel($vesselId: Int!) {
        vessel(vesselId: $vesselId) {
            ...VesselFragment
        }
    }
    ${VesselFragments.vessel}
    ${VesselFeaturesFragments.vesselFeatures}
    ${RegistrationFragments.registration}
    ${ReferentialFragments.location}
    ${ReferentialFragments.lightDepartment}
    ${ReferentialFragments.lightPerson}
    ${ReferentialFragments.referential}
`;

const SaveVessels: any = gql`
    mutation SaveVessels($vessels:[VesselVOInput]){
        saveVessels(vessels: $vessels){
            ...VesselFragment
        }
    }
    ${VesselFragments.vessel}
    ${VesselFeaturesFragments.vesselFeatures}
    ${RegistrationFragments.registration}
    ${ReferentialFragments.location}
    ${ReferentialFragments.lightDepartment}
    ${ReferentialFragments.lightPerson}
    ${ReferentialFragments.referential}
`;

const DeleteVessels: any = gql`
    mutation deleteVessels($ids:[Int]){
        deleteVessels(ids: $ids)
    }
`;

@Injectable({providedIn: 'root'})
export class VesselService
  extends BaseDataService
  implements TableDataService<Vessel, VesselFilter>, EditorDataService<Vessel, VesselFilter> {

  constructor(
    protected graphql: GraphqlService,
    private accountService: AccountService,
    private vesselFeatureService: VesselFeaturesService,
    private vesselRegistrationService: VesselRegistrationService,
  ) {
    super(graphql);
  }

  /**
   * Load many vessels
   * @param offset
   * @param size
   * @param sortBy
   * @param sortDirection
   * @param filter
   */
  watchAll(offset: number,
           size: number,
           sortBy?: string,
           sortDirection?: string,
           filter?: VesselFilter): Observable<LoadResult<Vessel>> {

    const variables: any = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || 'features.exteriorMarking',
      sortDirection: sortDirection || 'asc',
      filter: filter && {
        date: filter.date,
        vesselId: filter.vesselId,
        searchText: filter.searchText,
        statusIds: isNotNil(filter.statusId) ? [filter.statusId] : filter.statusIds
      }
    };

    this._lastVariables.loadAll = variables;
    this._lastVariables.load = undefined;

    const now = Date.now();
    if (this._debug) console.debug("[vessel-service] Getting vessels using options:", variables);

    return this.graphql.watchQuery<{ vessels: any[]; vesselsCount: number }>({
      query: LoadAllQuery,
      variables: variables,
      error: {code: ErrorCodes.LOAD_VESSELS_ERROR, message: "VESSEL.ERROR.LOAD_VESSELS_ERROR"}
    })
      .pipe(
        map(({vessels, vesselsCount}) => {
            const data = (vessels || []).map(Vessel.fromObject);
            const total = vesselsCount || undefined;
            if (this._debug) console.debug(`[vessel-service] Vessels loaded in ${Date.now() - now}ms`, data);
            return {
              data: data,
              total: total
            };
          }
        )
      );
  }

  async load(id: number, opts?: {
    fetchPolicy?: FetchPolicy
  }): Promise<Vessel | null> {
    console.debug("[vessel-service] Loading vessel " + id);

    const variables: any = {vesselId: id};

    this._lastVariables.load = variables;
    this._lastVariables.loadAll = undefined;

    const data = await this.graphql.query<{ vessel: any }>({
      query: LoadQuery,
      variables: variables,
      fetchPolicy: opts && opts.fetchPolicy || undefined
    });

    if (data && data.vessel) {
      const res = new Vessel();
      res.fromObject(data.vessel);
      return res;
    }
    return null;
  }

  /**
   * Save many vessels
   * @param vessels
   */
  async saveAll(vessels: Vessel[], options?: any): Promise<Vessel[]> {

    if (!vessels) return vessels;

    const json = vessels.map(vessel => {
      // Fill default properties (as recorder department and person)
      this.fillDefaultProperties(vessel);
      return this.asObject(vessel);
    });

    const now = Date.now();
    console.debug("[vessel-service] Saving vessels...", json);

    return new Promise<Vessel[]>((resolve, reject) => {
      this.graphql.mutate<{ saveVessels: Vessel[] }>({
        mutation: SaveVessels,
        variables: {
          vessels: json
        },
        error: { reject, code: ErrorCodes.SAVE_VESSELS_ERROR, message: "VESSEL.ERROR.SAVE_VESSELS_ERROR"},
        update: async (proxy, {data}) => {

          if (this._debug) console.debug(`[vessel-service] Vessels saved remotely in ${Date.now() - now}ms`, vessels);

          if (data && data.saveVessels) {
            (vessels || []).forEach(vessel => {
              const savedVessel = data.saveVessels.find(v => vessel.equals(v));
              if (savedVessel && savedVessel !== vessel) {
                this.copyIdAndUpdateDate(savedVessel, vessel);
              }
            });

            // update features history FIXME: marche pas
            if (options && options.isNewFeatures && this.vesselFeatureService.lastVariables()) {
              const lastFeatures = vessels[vessels.length - 1].features;
              this.graphql.addToQueryCache(proxy, {
                query: LoadFeaturesQuery,
                variables: this.vesselFeatureService.lastVariables()
              }, 'vesselFeaturesHistory', lastFeatures);
            }

            // update registration history FIXME: marche pas
            if (options && options.isNewRegistration && this.vesselRegistrationService.lastVariables()) {
              const lastRegistration = vessels[vessels.length - 1].registration;
              this.graphql.addToQueryCache(proxy, {
                query: LoadRegistrationsQuery,
                variables: this.vesselRegistrationService.lastVariables()
              }, 'vesselRegistrationHistory', lastRegistration);
            }

          }

          resolve(vessels);
        }
      });
    });
  }

  /**
   * Save a trip
   * @param vessel
   * @param options
   */
  async save(vessel: Vessel, options?: any): Promise<Vessel> {

    // prepare previous vessel to save if present
    if (options && isNotNil(options.previousVessel)) {

      // update previous features
      if (options.isNewFeatures) {
        // set end date = new start date - 1
        const newStartDate = vessel.features.startDate.clone();
        newStartDate.subtract(1, "seconds");
        options.previousVessel.features.endDate = newStartDate;

      } else
      // prepare previous registration period
      if (options.isNewRegistration) {
        // set registration end date = new registration start date - 1
        const newRegistrationStartDate = vessel.registration.startDate.clone();
        newRegistrationStartDate.subtract(1, "seconds");
        options.previousVessel.registration.endDate = newRegistrationStartDate;
      }

      // save both by calling saveAll
      const savedVessels: Vessel[] = await this.saveAll([options.previousVessel, vessel], options);
      // return last
      return Promise.resolve(savedVessels.pop());
    }

    // Prepare to save
    this.fillDefaultProperties(vessel);
    const isNew = isNil(vessel.id);

    // Transform into json
    const json = vessel.asObject({
      minify: true,
      keepTypename: false
    });

    const now = Date.now();
    console.debug("[vessel-service] Saving vessel: ", json);

    return new Promise<Vessel>((resolve, reject) => {
      this.graphql.mutate<{ saveVessels: any }>({
        mutation: SaveVessels,
        variables: {
          vessels: [json]
        },
        error: {reject, code: ErrorCodes.SAVE_VESSEL_ERROR, message: "VESSEL.ERROR.SAVE_VESSEL_ERROR"},
        update: (proxy, {data}) => {
          const savedVessel = data && data.saveVessels && data.saveVessels[0];

          if (savedVessel) {

            // Copy id and update Date
            this.copyIdAndUpdateDate(savedVessel, vessel);

            if (this._debug) console.debug(`[vessel-service] Vessel Feature saved in ${Date.now() - now}ms`, savedVessel);

            // Add to cache
            if (isNew && this._lastVariables.loadAll) {
              this.graphql.addToQueryCache(proxy, {
                query: LoadAllQuery,
                variables: this._lastVariables.loadAll
              }, 'vessels', savedVessel);
            }
            // Update cache
            else if (this._lastVariables.load) {
              this.graphql.updateToQueryCache(proxy, {
                query: LoadQuery,
                variables: this._lastVariables.load
              }, 'vessel', savedVessel);
            }

          }

          resolve(vessel);
        }

      });
    });

  }

  delete(data: Vessel, options?: any): Promise<any> {
    return this.deleteAll([data]);
  }

  deleteAll(vessels: Vessel[]): Promise<any> {
    const ids = vessels && vessels
      .map(t => t.id)
      .filter(id => (id > 0));

    console.debug("[vessel-service] Deleting vessels... ids:", ids);

    return this.graphql.mutate<any>({
      mutation: DeleteVessels,
      variables: {
        ids: ids
      }
    });
  }

  listenChanges(id: number, options?: any): Observable<Vessel> {
    throw new Error("Method not implemented.");
  }

  /* -- protected methods -- */

  protected asObject(vessel: Vessel, options?: EntityAsObjectOptions): any {
    return vessel.asObject({...MINIFY_OPTIONS, options} as EntityAsObjectOptions);
  }

  protected fillDefaultProperties(vessel: Vessel): void {

    const person: Person = this.accountService.account;

    // Recorder department
    if (person && person.department && (!vessel.recorderDepartment || vessel.recorderDepartment.id !== person.department.id)) {
      if (!vessel.recorderDepartment) {
        vessel.recorderDepartment = new Department();
      }
      vessel.recorderDepartment.id = person.department.id;
      if (vessel.features) {
        if (!vessel.features.recorderDepartment) {
          vessel.features.recorderDepartment = new Department();
        }
        vessel.features.recorderDepartment.id = person.department.id;
      }
    }

    // Recorder person
    if (person && (!vessel.recorderPerson || vessel.recorderPerson.id !== person.id)) {
      if (!vessel.recorderPerson) {
        vessel.recorderPerson = new Person();
      }
      vessel.recorderPerson.id = person.id;
      if (vessel.features) {
        if (!vessel.features.recorderPerson) {
          vessel.features.recorderPerson = new Person();
        }
        vessel.features.recorderPerson.id = person.id;
      }
    }

    // Quality flag (set default)
    if (vessel.features && isNil(vessel.features.qualityFlagId)) {
      vessel.features.qualityFlagId = QualityFlagIds.NOT_QUALIFIED;
    }

  }

  copyIdAndUpdateDate(source: Vessel | undefined, target: Vessel) {

    EntityUtils.copyIdAndUpdateDate(source, target);
    EntityUtils.copyIdAndUpdateDate(source.features, target.features);
    EntityUtils.copyIdAndUpdateDate(source.registration, target.registration);

  }
}
