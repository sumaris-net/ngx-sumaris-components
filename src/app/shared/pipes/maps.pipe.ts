import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {isNotNil} from '../functions';

@Pipe({
    name: 'mapGet'
})
@Injectable({providedIn: 'root'})
export class MapGetPipe implements PipeTransform {

    transform(val: any, args: string | {key: string} ): any {
      if (!val) return null;
      const key = args && (typeof args === 'string' ? args : args.key);
      if (!key) return null;
      return val[key];
    }
}

@Pipe({
  name: 'mapKeys'
})
@Injectable({providedIn: 'root'})
export class MapKeysPipe implements PipeTransform {

  transform(map: any): any[] {
    if (!map) return null;
    return Object.keys(map);
  }
}

@Pipe({
  name: 'mapValues'
})
@Injectable({providedIn: 'root'})
export class MapValuesPipe implements PipeTransform {

  transform(map: any): any[] {
    if (!map) return null;
    return Object.values(map);
  }
}
