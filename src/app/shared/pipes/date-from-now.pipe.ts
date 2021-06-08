import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {isMoment, Moment} from 'moment';
import {DATE_ISO_PATTERN} from '../constants';
import {MomentDateAdapter} from '@angular/material-moment-adapter';

@Pipe({
  name: 'dateFromNow'
})
@Injectable({providedIn: 'root'})
export class DateFromNowPipe implements PipeTransform {

  constructor(
    private dateAdapter: MomentDateAdapter) {
  }

  transform(value: string | Moment, args?: any): string | Promise<string> {
    const date: Moment = isMoment(value) ? value as Moment : this.dateAdapter.parse(value, DATE_ISO_PATTERN);
    return date ? date.fromNow(args && args.withoutSuffix) : '';
  }
}
