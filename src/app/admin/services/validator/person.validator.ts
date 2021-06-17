import { Injectable } from '@angular/core';
import { ValidatorService } from '@e-is/ngx-material-table';
import {FormGroup, FormBuilder, Validators} from '@angular/forms';
import { Person } from '../../../core/services/model/person.model';
import { Account } from '../../../core/services/model/account.model';
import { SharedValidators } from '../../../shared/validator/validators';
import {AccountValidatorService} from '../../../core/services/validator/account.validator';

@Injectable({providedIn: 'root'})
export class PersonValidatorService implements ValidatorService {

  constructor(
    protected formBuilder: FormBuilder,
    protected accountValidatorService: AccountValidatorService
  ) {
  }

  getRowValidator(): FormGroup {
    return this.getFormGroup();
  }

  getFormGroup(data?: Person): FormGroup {

    // Use account validator as base form group definition
    // BUT add more flexibility (e.g. 'pubkey' become optional)
    // This is need to be able to store person that are not using SUMARiS tools (e.g. onboard observers)
    const formConfig = this.accountValidatorService.getFormGroupConfig(data && Account.fromObject(data.asObject()));
    formConfig.pubkey = [data && data.pubkey || null, SharedValidators.pubkey];
    formConfig.username = [data && data.username || null, Validators.minLength(2)];
    formConfig.usernameExtranet = [data && data.usernameExtranet || null, Validators.minLength(2)];
    formConfig.avatar = [data && data.avatar || null];

    return this.formBuilder.group(formConfig);
  }


}
