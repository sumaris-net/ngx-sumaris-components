import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {Person, personsToString, personToString} from '../model/person.model';

@Pipe({
  name: 'personToString'
})
@Injectable({providedIn: 'root'})
export class PersonToStringPipe implements PipeTransform {


  transform(value: Person | Person[] ): string {
    if (value instanceof Array) return personsToString(value);
    return personToString(value);
  }
}

