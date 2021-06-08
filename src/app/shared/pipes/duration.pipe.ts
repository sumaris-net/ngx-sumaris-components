import {Pipe, Injectable, PipeTransform} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {toDuration} from '../dates';

@Pipe({
  name: 'duration'
})
@Injectable({providedIn: 'root'})
export class DurationPipe implements PipeTransform {

  protected dayUnit: string;

  constructor(
    private translate: TranslateService
  ) {
    this.dayUnit = translate.instant('COMMON.DAY_UNIT');
  }

  transform(value: number, args?: any): string {
    if (!value) return '';
    const unit = args && args.unit || 'hours';

    // try with moment
    const duration = toDuration(value, unit);

    const days = duration.days();
    const hour = duration.hours().toString().padStart(2, '0');
    const minute = duration.minutes().toString().padStart(2, '0');

    return (days > 0 ? days.toString() + (this.dayUnit + ' ') : '') + hour + ':' + minute;

  }
}
