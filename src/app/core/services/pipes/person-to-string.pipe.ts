import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {Person, PersonUtils} from '../model/person.model';
import {isArray} from '../../../shared/functions';

@Pipe({
  name: 'personToString'
})
@Injectable({providedIn: 'root'})
export class PersonToStringPipe implements PipeTransform {

  transform(value: Person | Person[] ): string {
    if (isArray(value)) return PersonUtils.personsToString(value);
    return PersonUtils.personToString(value as Person);
  }
}

