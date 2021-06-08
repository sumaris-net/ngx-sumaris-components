import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {getPropertyByPath} from '../functions';

@Pipe({
    name: 'propertyGet'
})
@Injectable({providedIn: 'root'})
export class PropertyGetPipe implements PipeTransform {

    transform(obj: any, args: string | {key: string; defaultValue?: any } ): any {
      return getPropertyByPath(obj,
        // Path
        args && (typeof args === 'string' ? args : args.key),
        // Default value
        args && (args as any).defaultValue);
    }
}
