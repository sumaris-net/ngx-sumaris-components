import { Pipe, Injectable, PipeTransform } from '@angular/core';

@Pipe({
    name: 'highlight'
})
@Injectable({providedIn: 'root'})
export class HighlightPipe implements PipeTransform {

    transform(value: any, args?: string | { search: string } ): string {
      if (typeof value !== 'string' || !args) return value;
      const searchText = (typeof args === 'string' ? args : args.search);
      if (typeof searchText !== 'string') return value;
      const searchRegexp = searchText
        .replace(/[.]/g, '[.]').replace(/[*]+/g, '.*');
      if (searchRegexp === '.*') return value; // skip if can match everything
      const regexp = new RegExp('[ ]?' + searchRegexp, 'gi');
      return ('' + value).replace(regexp, '<b>$&</b>');
    }
}
