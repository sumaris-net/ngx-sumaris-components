import {ValidatorService} from '@e-is/ngx-material-table';
import {FormGroup} from '@angular/forms';

export interface IValidatorService<T> extends ValidatorService {

  getFormGroup(data?: T): FormGroup;
}
