import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {isNilOrBlank, isNotNilOrBlank} from '../functions';

@Pipe({
  name: 'isNotNilOrBlank'
})
@Injectable({providedIn: 'root'})
export class IsNotNilOrBlankPipe implements PipeTransform {
  transform(value: string): boolean {
    return isNotNilOrBlank(value);
  }
}

@Pipe({
  name: 'isNilOrBlank'
})
@Injectable({providedIn: 'root'})
export class IsNilOrBlankPipe implements PipeTransform {
  transform(value: string): boolean {
    return isNilOrBlank(value);
  }
}

@Pipe({
  name: 'toString'
})
@Injectable({providedIn: 'root'})
export class ToStringPipe implements PipeTransform {
  transform(value: number): string {
    return value ? value?.toString() : '';
  }
}
