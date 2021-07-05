import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {isNotNil} from '../functions';

@Pipe({
    name: 'isNotEmptyArray'
})
export class NotEmptyArrayPipe implements PipeTransform {

    transform(val: any[]): any {
      if (val === undefined || val === null) {
        return false;
      }
      return val.length > 0;
    }
}


@Pipe({
  name: 'isEmptyArray'
})
export class EmptyArrayPipe implements PipeTransform {

  transform(val: any[]): any {
    if (val === undefined || val === null) {
      return true;
    }
    return val.length === 0;
  }
}


@Pipe({
  name: 'isArrayLength'
})
export class ArrayLengthPipe implements PipeTransform {

  transform(val: any[], args?: { greaterThan?: number; equals?: number; lessThan?: number }): any {
    args = args || {};
    const size = (val === undefined || val === null) ? 0 : val.length;
    if (isNotNil(args.lessThan)) {
      return size < args.lessThan;
    }
    if (isNotNil(args.greaterThan)) {
      return size > args.greaterThan;
    }
    if (isNotNil(args.equals)) {
      return size === args.equals;
    }
    return false;
  }
}

@Pipe({
  name: 'arrayFirst'
})
export class ArrayFirstPipe implements PipeTransform {

  transform(val: any[]): any {
    return val && val.length > 0 ? val[0] : undefined;
  }
}

@Pipe({
  name: 'arrayPluck'
})
export class ArrayPluckPipe implements PipeTransform {

  transform<T>(val: T[], opts: { property: string; omitNil?: boolean }): any[] {
    return (opts.omitNil !== true) ?
      (val || []).map(value => value && value[opts.property]) :
      (val || []).map(value => value && value[opts.property]).filter(isNotNil);
  }
}

@Pipe({
  name: 'arrayIncludes'
})
export class ArrayIncludesPipe implements PipeTransform {

  transform(val: any[], args): any {
    return val && val.includes(args);
  }
}


@Pipe({
  name: 'arrayFilter'
})
export class ArrayFilterPipe implements PipeTransform {

  transform(val: any[], filterFn: (any) => boolean): any {
    return val && val.filter(filterFn);
  }
}
