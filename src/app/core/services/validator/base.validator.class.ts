import {ValidatorService} from '@e-is/ngx-material-table';
import {FormBuilder, FormGroup} from '@angular/forms';
import {IValidatorService} from '../../../shared/services/validator-service.class';
import {Directive} from '@angular/core';

@Directive()
export abstract class AppValidatorService<T = any>
  extends ValidatorService
  implements IValidatorService<T> {

  protected constructor(protected formBuilder: FormBuilder) {
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

}
