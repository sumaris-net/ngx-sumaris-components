import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {TranslateContextService} from '../services/translate-context.service';
import {changeCaseToUnderscore, isNilOrBlank} from '../functions';

@Pipe({
    name: 'translateContext'
})
@Injectable({providedIn: 'root'})
export class TranslateContextPipe implements PipeTransform {

  constructor(
    protected translateContext: TranslateContextService
  ) {
  }

  transform(key: string, context?: string): string {
    return this.translateContext.instant(key, context);
  }
}


@Pipe({
  name: 'translatable'
})
@Injectable({providedIn: 'root'})
export class TranslatablePipe implements PipeTransform {
  transform(value: string): string {
    // transform a string to a i18n compatible string (ex: QualitativeValue -> QUALITATIVE_VALUE)
    return changeCaseToUnderscore(value)?.toUpperCase();
  }
}

