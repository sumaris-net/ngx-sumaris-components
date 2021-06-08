import {Injectable, Pipe, PipeTransform} from '@angular/core';

import {UsageMode} from '../model/settings.model';

@Pipe({
  name: 'isOnField'
})
@Injectable({providedIn: 'root'})
export class IsOnFieldModePipe implements PipeTransform {

  transform(value: UsageMode): boolean {
    return value === 'FIELD';
  }
}


@Pipe({
  name: 'isNotOnField'
})
@Injectable({providedIn: 'root'})
export class IsNotOnFieldModePipe implements PipeTransform {

  transform(value: UsageMode): boolean {
    return value !== 'FIELD';
  }
}
