import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {Department, departmentsToString, departmentToString} from '../model/department.model';

@Pipe({
  name: 'departmentToString'
})
@Injectable({providedIn: 'root'})
export class DepartmentToStringPipe implements PipeTransform {

  transform(value: Department | (Department[]) ): string {
    if (value instanceof Array) return departmentsToString(value);
    return departmentToString(value);
  }
}

