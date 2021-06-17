import {EntityClass} from '../../../core/services/model/entity.decorators';
import {EntityFilter} from '../../../core/services/model/filter.model';
import {Person} from '../../../core/services/model/person.model';
import {FilterFn} from '../../../shared/services/entity-service.class';
import {EntityAsObjectOptions, EntityUtils} from '../../../core/services/model/entity.model';
import {StoreObject} from '@apollo/client/core';
import {isNil, isNotEmptyArray, isNotNil} from '../../../shared/functions';

// @dynamic
@EntityClass({typename: 'PersonFilterVO'})
export class PersonFilter extends EntityFilter<PersonFilter, Person> {

    static fromObject: (source, opts?: any) => PersonFilter;

    static searchFilter(source: any): FilterFn<Person> {
        return source && PersonFilter.fromObject(source).asFilterFn();
    }

    email: string;
    pubkey: string;
    searchText: string;
    statusIds: number[];
    userProfiles: string[];
    excludedIds: number[];
    searchAttribute: string;

    constructor() {
      super(PersonFilter.TYPENAME);
    }

    fromObject(source: any, opts?: EntityAsObjectOptions) {
        super.fromObject(source, opts);
        this.email = source.email;
        this.pubkey = source.pubkey;
        this.searchText = source.searchText;
        this.statusIds = source.statusIds || (isNotNil(source.statusId) ? [source.statusId] : undefined);
        this.userProfiles = source.userProfiles;
        this.excludedIds = source.excludedIds;
        this.searchAttribute = source.searchAttribute;
    }

    asObject(opts?: EntityAsObjectOptions): StoreObject {
        const target = super.asObject(opts);
        target.email = this.email;
        target.pubkey = this.pubkey;
        target.searchText = this.searchText;
        target.statusIds = this.statusIds;
        target.userProfiles = this.userProfiles;
        target.excludedIds = this.excludedIds;
        target.searchAttribute = this.searchAttribute;
        return target;
    }

    protected buildFilter(): FilterFn<Person>[] {

        const filterFns = super.buildFilter();

        // Filter by status
        if (isNotEmptyArray(this.statusIds)) {
            filterFns.push(e => this.statusIds.includes(e.statusId));
        }

        // Filter excluded ids
        if (isNotEmptyArray(this.excludedIds)) {
            filterFns.push(e => isNil(e.id) || !this.excludedIds.includes(e.id));
        }

        // Search text
        const searchTextFilter = EntityUtils.searchTextFilter(this.searchAttribute || ['lastName', 'firstName', 'department.name'], this.searchText);
        if (searchTextFilter) filterFns.push(searchTextFilter);

        return filterFns;
    }
}
