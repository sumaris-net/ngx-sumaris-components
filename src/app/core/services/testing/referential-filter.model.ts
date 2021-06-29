import {EntityClass} from '../model/entity.decorators';
import {EntityFilter} from '../model/filter.model';
import {Referential} from '../model/referential.model';
import {EntityUtils} from '../model/entity.model';
import {FilterFn} from '../../../shared/services/entity-service.class';

@EntityClass({typename: 'ReferentialFilterVO'})
export class ReferentialFilter extends EntityFilter<ReferentialFilter, Referential> {

  static fromObject: (source: any, opts?: any) => ReferentialFilter;

  searchText: string;

  fromObject(source: any, opts?: any) {
    super.fromObject(source, opts);
    this.searchText = source.searchText;
  }

  protected buildFilter(): FilterFn<Referential>[] {
    const target = super.buildFilter();

    const searchTextFn = EntityUtils.searchTextFilter(['label', 'name'], this.searchText);
    if (searchTextFn) target.push(searchTextFn);

    return target;
  }
}
