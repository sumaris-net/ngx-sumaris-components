import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {SharedValidators} from '../../../validator/validators';
import {MatAutocompleteConfigHolder} from '../material.autocomplete';
import {isNotNil, suggestFromArray} from '../../../functions';
import {BehaviorSubject} from 'rxjs';
import {LoadResult} from '../../../services/entity-service.class';
import Timer = NodeJS.Timer;

export class Entity {
  id: number;
  label: string;
  name: string;
}

const FAKE_ENTITIES = [
  {id: 1, label: 'AAA', name: 'Item A', description: 'Very long description A', comments: 'Very very long comments... again for A'},
  {id: 2, label: 'BBB', name: 'Item B', description: 'Very long description B', comments: 'Very very long comments... again for B'},
  {id: 3, label: 'CCC', name: 'Item C', description: 'Very long description C', comments: 'Very very long comments... again for C'}
];

function deepCopy(values?: Entity[]): Entity[] {
  return (values || FAKE_ENTITIES).map(entity => Object.assign({}, entity));
}

@Component({
  selector: 'app-autocomplete-test',
  templateUrl: './autocomplete.test.html'
})
export class AutocompleteTestPage implements OnInit {

  _items = deepCopy(FAKE_ENTITIES);
  $items = new BehaviorSubject<Entity[]>(undefined);

  form: FormGroup;
  autocompleteFields = new MatAutocompleteConfigHolder();
  memoryHide = false;
  memoryMobile = true;
  memoryAutocompleteFieldName = 'entity-$items';
  memoryTimer: Timer;

  mode: 'mobile'|'desktop'|'memory'|'temp' = 'temp';

  constructor(
    protected formBuilder: FormBuilder
  ) {
    this.form = formBuilder.group({
      entity: [null, SharedValidators.entity],
      missingEntity: [null, SharedValidators.entity],
      disableEntity: [null, SharedValidators.entity],
    });

    this.form.get('disableEntity').disable();
  }

  ngOnInit() {

    // From suggest
    this.autocompleteFields.add('entity-suggestFn', {
      suggestFn: (value, filter) => this.suggest(value, filter),
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    // From items array
    this.autocompleteFields.add('entity-items', {
      items: FAKE_ENTITIES.slice(),
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    // From $items observable
    this.autocompleteFields.add('entity-$items', {
      items: this.$items,
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    // From $items with filter
    this.autocompleteFields.add('entity-items-filter', {
      service: {
        suggest: (value, filter) => this.suggest(value, filter)
      },
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    // From items
    this.autocompleteFields.add('entity-items-large', {
      items: FAKE_ENTITIES.slice(),
      attributes: ['label', 'name', 'description', 'comments'],
      displayWith: this.entityToString
    });

    this.loadData();

  }

  // Load the form with data
  async loadData() {
    const data = {
      entity: deepCopy(FAKE_ENTITIES)[1], // Select the second

      // This item is NOT in the items list => i should be displayed anyway
      missingEntity: {
        id: -1, label: '??', name: 'Missing item'
      },

      disableEntity: deepCopy(FAKE_ENTITIES)[2]
    };

    this.form.setValue(data);

    // Load observables
    setTimeout(() => this.loadItems(), 1000);
  }

  async loadItems() {
    const items = deepCopy(FAKE_ENTITIES);
    this.$items.next(items);
  }

  entityToString(item: any) {
    return [item && item.label || undefined, item && item.name || undefined].filter(isNotNil).join(' - ');
  }

  async suggest(value: any, filter?: any): Promise<LoadResult<any>> {
    return suggestFromArray(this._items, value, {
      ...filter,
      searchAttributes: ['label', 'name']
    });
  }

  doSubmit(event) {

    console.debug('Validate form: ', this.form.value);
  }

  compareWithFn(o1: Entity, o2: Entity): boolean {
    return o1 && o2 && o1.id === o2.id;
  }

  toggleMode(value) {
    if (this.mode !== value) {
      this.mode = value;
      this.stopMemoryTimer();
    }
  }

  startMemoryTimer() {
    this.memoryTimer = setInterval(() => {
      this.memoryHide = !this.memoryHide;
    }, 50);
  }

  stopMemoryTimer() {
    clearInterval(this.memoryTimer);
    this.memoryTimer = null;
    this.memoryHide = false;
  }

  updateFilter(fieldName: string) {
    const filter: { searchAttribute?: string } = this.autocompleteFields.get(fieldName).filter || {};
    filter.searchAttribute = (!filter || filter.searchAttribute !== 'name') ? 'name' : 'label';
  }

  /* -- protected methods -- */

  stringify(value: any) {
    return JSON.stringify(value);
  }
}

