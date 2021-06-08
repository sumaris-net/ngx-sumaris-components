import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {BehaviorSubject} from 'rxjs';
import {SharedValidators} from '../../../validator/validators';
import {MatAutocompleteConfigHolder} from '../../autocomplete/material.autocomplete';
import {isNotNil, suggestFromArray} from '../../../functions';
import {LoadResult} from '../../../services/entity-service.class';

export class Entity {
  id: number;
  label: string;
  name: string;
}

const FAKE_ENTITIES: Entity[] = [
  {id: 1, label: 'AAA', name: 'Item A'},
  {id: 2, label: 'BBB', name: 'Item B'},
  {id: 3, label: 'CCC', name: 'Item C'}
];

function deepCopy(values?: Entity[]): Entity[] {
  return (values || FAKE_ENTITIES).map(entity => Object.assign({}, entity));
}

@Component({
  selector: 'app-chips-test',
  templateUrl: './chips.test.html'
})
export class ChipsTestPage implements OnInit {

  private _items = deepCopy(FAKE_ENTITIES);
  private _$items = new BehaviorSubject<Entity[]>(undefined);

  form: FormGroup;
  autocompleteFields = new MatAutocompleteConfigHolder();

  constructor(
    protected formBuilder: FormBuilder
  ) {
    this.form = formBuilder.group({
      entity: [null, SharedValidators.entity],
      entityInitial: [null, SharedValidators.entity],
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

    // From items
    this.autocompleteFields.add('entity-items', {
      items: FAKE_ENTITIES.slice(),
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    // From items
    this.autocompleteFields.add('entity-$items', {
      items: this._$items,
      attributes: ['label', 'name'],
      displayWith: this.entityToString
    });

    this.loadData();
    //setTimeout(() => this.loadData(), 1500);

    //
    setTimeout(() => this.loadItems(), 1000);
  }

  // Load the form with data
  async loadData() {
    const data = {
      entity: [],

      // THis item is NOT in the items list => i should be displayed anyway
      entityInitial: FAKE_ENTITIES.slice(1, 2),

      disableEntity: FAKE_ENTITIES.slice(1, 2)
    };

    this.form.setValue(data);
  }

  async loadItems() {
    this._$items.next(deepCopy(FAKE_ENTITIES));
  }

  entityToString(item: any) {
    return [item && item.label || undefined, item && item.name || undefined].filter(isNotNil).join(' - ');
  }

  async suggest(value: any, filter?: any): Promise<LoadResult<Entity>> {
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
  /* -- protected methods -- */


  stringify(value: any) {
    return JSON.stringify(value);
  }
}

