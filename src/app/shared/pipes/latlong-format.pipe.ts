import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {formatLatitude, formatLongitude} from '../material/latlong/latlong.utils';


@Pipe({
  name: 'latLongFormat'
})
@Injectable({providedIn: 'root'})
/**
 * @deprecated use 'latitudeFormat' or 'longitudeFormat' instead
 */
export class LatLongFormatPipe implements PipeTransform {

    transform(value: number, args?: any): string | Promise<string> {
        return ((!args.type || args.type !== 'latitude') ? formatLongitude : formatLatitude)(value, args);
    }


}
@Pipe({
  name: 'latitudeFormat'
})
@Injectable({providedIn: 'root'})
export class LatitudeFormatPipe implements PipeTransform {
  transform = formatLatitude;
}

@Pipe({
  name: 'longitudeFormat'
})
@Injectable({providedIn: 'root'})
export class LongitudeFormatPipe implements PipeTransform {
  transform = formatLongitude;
}
