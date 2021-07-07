import {ValidatorService} from '@e-is/ngx-material-table';
import {AbstractControl, FormBuilder, FormGroup} from '@angular/forms';
import {IValidatorService} from '../../../shared/services/validator-service.class';
import {Directive} from '@angular/core';
import {AppFormUtils, FormErrors} from '../../form/form.utils';
import {changeCaseToUnderscore, isEmptyArray} from '../../../shared/functions';
import {TranslateService} from '@ngx-translate/core';

@Directive()
export abstract class AppValidatorService<T = any>
  extends ValidatorService
  implements IValidatorService<T> {

  protected constructor(
    protected formBuilder: FormBuilder,
    protected translate?: TranslateService
  ) {
    super();
  }

  getRowValidator(): FormGroup {
    return this.getFormGroup();
  }

  getFormGroup(data?: T): FormGroup {
    return this.formBuilder.group(this.getFormGroupConfig(data));
  }

  getFormGroupConfig(data?: T): { [key: string]: any}  {
    return {};
  }

  getI18nFormErrors(control: AbstractControl): string[] {
    const errors = AppFormUtils.getFormErrors(control);
    return this.getI18nErrors(errors);
  }

  getI18nErrors(errors: FormErrors): string[] {
    return Object.keys(errors || {}).map(errorKey => this.getI18nError(errorKey, errors[errorKey]));
  }

  protected getI18nError(errorKey: string, errorContent?: any) {
    const i18nKey = 'ERROR.FIELD_' + changeCaseToUnderscore(errorKey).toUpperCase();
    const i18nMessage = this.translate.instant(i18nKey, errorContent);
    if (i18nKey !== i18nMessage) return i18nMessage;
    if (typeof errorContent === 'string') return errorContent;

    // Not translated: show error
    console.error(`[validator] Cannot translate error key '${errorKey}'. Please override translateError() in your validator`);

    return changeCaseToUnderscore(errorKey);
  }
}
