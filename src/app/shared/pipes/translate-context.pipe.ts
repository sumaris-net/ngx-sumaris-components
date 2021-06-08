import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {TranslateContextService} from '../services/translate-context.service';

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
