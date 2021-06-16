import {Inject, Injectable} from '@angular/core';
import {FetchPolicy, gql} from '@apollo/client/core';
import {BehaviorSubject} from 'rxjs';
import {GraphqlService} from '../../core/graphql/graphql.service';
import {NetworkService} from '../../core/services/network.service';
import {EntitiesStorage} from '../../core/services/storage/entities-storage.service';
import {Person, UserProfileLabel} from '../../core/services/model/person.model';
import {ReferentialUtils} from '../../core/services/model/referential.model';
import {StatusIds} from '../../core/services/model/model.enum';
import {SortDirection} from '@angular/material/sort';
import {JobUtils} from '../../shared/services/job.utils';
import {LoadResult, SuggestService} from '../../shared/services/entity-service.class';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {PlatformService} from '../../core/services/platform.service';
import {PersonFilter} from './filter/person.filter';
import {isInstanceOf} from '../../core/services/model/entity.model';
import {BaseEntityGraphqlMutations, BaseEntityService} from '../../core/services/base-entity-service.class';

export const PersonFragments = {
  person: gql`fragment PersonFragment on PersonVO {
    id
    firstName
    lastName
    email
    pubkey
    avatar
    statusId
    updateDate
    creationDate
    profiles
    department {
      id
      label
      name
      logo
      __typename
    }
    __typename
  }
  `
};

// Load persons query
const PersonQueries = {
  loadAll: gql`
    query Persons($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: PersonFilterVOInput){
      data: persons(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
        ...PersonFragment
      }
    }
    ${PersonFragments.person}`,

  loadAllWithTotal: gql`
    query PersonsWithTotal($offset: Int, $size: Int, $sortBy: String, $sortDirection: String, $filter: PersonFilterVOInput){
      data: persons(filter: $filter, offset: $offset, size: $size, sortBy: $sortBy, sortDirection: $sortDirection){
        ...PersonFragment
      }
      total: personsCount(filter: $filter)
    }
    ${PersonFragments.person}`
};


const PersonMutations: BaseEntityGraphqlMutations = {
  saveAll: gql`
    mutation savePersons($persons:[PersonVOInput]){
      data: savePersons(persons: $persons){
        ...PersonFragment
      }
    }
    ${PersonFragments.person}`,
  deleteAll: gql`
    mutation deletePersons($ids:[Int]){
      deletePersons(ids: $ids)
    }`
};

@Injectable({providedIn: 'root'})
export class PersonService extends BaseEntityService<Person, PersonFilter>
  implements SuggestService<Person, PersonFilter> {

  constructor(
    protected graphql: GraphqlService,
    protected platform: PlatformService,
    protected network: NetworkService,
    protected entities: EntitiesStorage,
    @Inject(ENVIRONMENT) protected environment
  ) {
    super(graphql, platform, Person, PersonFilter, {
      queries: PersonQueries,
      mutations: PersonMutations,
      defaultSortBy: 'lastName'
    });

    // for DEV only -----
    this._debug = !environment.production;
  }

  async loadAll(offset: number, size: number, sortBy?: string,
                sortDirection?: SortDirection,
                filter?: Partial<PersonFilter>, opts?: {
        [key: string]: any;
        fetchPolicy?: FetchPolicy;
        debug?: boolean;
        withTotal?: boolean;
        toEntity?: boolean;
      }): Promise<LoadResult<Person>> {

    const offline = this.network.offline && (!opts || opts.fetchPolicy !== 'network-only');
    if (offline) {
      return this.loadAllLocally(offset, size, sortBy, sortDirection, filter, opts);
    }

    return super.loadAll(offset, size, sortBy, sortDirection, filter, opts);
  }

  async loadAllLocally(offset: number, size: number, sortBy?: string, sortDirection?: SortDirection,
                       filter?: Partial<PersonFilter>,
                       opts?: {
                         [key: string]: any;
                         fetchPolicy?: FetchPolicy;
                         debug?: boolean;
                         withTotal?: boolean;
                         toEntity?: boolean;
                       }): Promise<LoadResult<Person>> {

    filter = this.asFilter(filter);

    const variables = {
      offset: offset || 0,
      size: size || 100,
      sortBy: sortBy || this.defaultSortBy,
      sortDirection: sortDirection || this.defaultSortDirection,
      filter: filter && filter.asFilterFn()
    };

    const {data, total} = await this.entities.loadAll<Person>('PersonVO', variables);

    const entities = (!opts || opts.toEntity !== false) ?
      (data || []).map(Person.fromObject) :
      (data || []) as Person[];
    return {
      data: entities,
      total
    };
  }

  async suggest(value: any, filter?: PersonFilter): Promise<LoadResult<Person>> {
    if (ReferentialUtils.isNotEmpty(value)) return {data: [value]};
    value = (typeof value === 'string' && value !== '*') && value || undefined;
    return this.loadAll(0, !value ? 30 : 10, undefined, undefined,
      {
        ...filter,
        searchText: value as string,
        statusIds: filter && filter.statusIds || [StatusIds.ENABLE],
        userProfiles: filter && filter.userProfiles
      },
      { withTotal: true /* need by autocomplete */ }
      );
  }

  async executeImport(progression: BehaviorSubject<number>,
                opts?: {
                  maxProgression?: number;
                }): Promise<void> {

    const maxProgression = opts && opts.maxProgression || 100;
    const filter = {
      statusIds: [StatusIds.ENABLE, StatusIds.TEMPORARY],
      userProfiles: <UserProfileLabel[]>['SUPERVISOR', 'USER', 'GUEST']
    };

    console.info('[person-service] Importing persons...');

    const res = await JobUtils.fetchAllPages((offset, size) =>
        super.loadAll(offset, size, 'id', null, filter, {
          debug: false,
          fetchPolicy: 'network-only',
          withTotal: (offset === 0), // Compute total only once
          toEntity: false
        }),
      progression,
      {maxProgression: maxProgression * 0.9}
    );

    // Save result locally
    await this.entities.saveAll(res.data, {entityName: 'PersonVO', reset: true});
  }

  /* -- protected methods -- */

  protected asObject(source: Person | any): any {
    if (!source) return undefined;

    if (!isInstanceOf(source, Person)) {
      source = Person.fromObject(source);
    }
    const target = source.asObject();

    // Not known in server GraphQL schema
    delete target.mainProfile;

    // Minify the department object
    target.department = source.department && source.department.asObject(true);

    return target;
  }

}
