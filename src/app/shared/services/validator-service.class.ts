import {ValidatorService} from '@e-is/ngx-material-table';
import {AbstractControl, FormGroup} from '@angular/forms';

export interface IValidatorService<T> extends ValidatorService {

  getFormGroup(data?: T): FormGroup;

  /**
   * Compute errors from a controls
   * @param control any control, or FormGroup, or FormArray
   */
  getI18nFormErrors(control: AbstractControl): string[];

}
