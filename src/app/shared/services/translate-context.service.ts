import {Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {mergeMap} from 'rxjs/operators';
import {of, Observable} from 'rxjs';
import {isNilOrBlank} from '../functions';


@Injectable({providedIn: 'root'})
export class TranslateContextService {

  constructor(
    protected translate: TranslateService
  ) {
  }

  get(key: string, context?: string, interpolateParams?: Object): Observable<any> {
    // No context: do a normal translate
    if (isNilOrBlank(context)) return this.translate.get(key, interpolateParams);

    // Compute a contextual i18n key, using the context as suffix
    const contextKey = this.contextualKey(key, context);

    // Return the contextual translation, or default of not exists
    return this.translate.get(contextKey)
      .pipe(
        mergeMap(translation => (translation !== contextKey) ? of(translation) : this.translate.get(key))
      );
  }

  instant(key: string, context?: string, interpolateParams?: Object): any {
    // No context: do a normal translate
    if (isNilOrBlank(context)) return this.translate.instant(key, interpolateParams);

    // Compute a contextual i18n key, using the context as suffix
    const contextualKey = this.contextualKey(key, context);

    // Return the contextual translation, or default of not exists
    const translation = this.translate.instant(contextualKey);
    return (translation !== contextualKey) ? translation : this.translate.instant(key);
  }

  /**
   * Compute a contextual i18n key, using the context as suffix
   *
   * @param key
   * @param context
   * @private
   */
  contextualKey(key: string, context: string) {

    // Append a dot on context if missing
    if (!context.endsWith('.')) {
      context = context + '.';
    }

    // Compute a contextual i18n key, using the context as suffix
    const parts = key.split('.');
    return (parts.length === 1)
      ? `${context}${key}`
      : parts.slice(0, parts.length - 1).concat(context + parts[parts.length - 1]).join('.');
  }
}
