import {Injectable} from '@angular/core';
import {FormBuilder, ValidatorFn, Validators} from '@angular/forms';
import {Account} from '../model/account.model';
import {getMainProfile} from '../model/person.model';
import {StatusIds} from '../model/model.enum';
import {AccountService} from '../account.service';
import {SharedValidators} from '../../../shared/validator/validators';
import {FormFieldDefinition} from '../../../shared/form/field.model';
import {AppValidatorService} from './base.validator.class';

@Injectable({providedIn: 'root'})
export class AccountValidatorService extends AppValidatorService<Account> {

  constructor(
    protected formBuilder: FormBuilder,
    protected accountService: AccountService
  ) {
    super(formBuilder);
  }

  getFormGroupConfig(data?: Account): any {
    const formDef = {
      id: [''],
      updateDate: [''],
      creationDate: [''],
      lastName: [data && data.lastName || null, Validators.compose([Validators.required, Validators.minLength(2)])],
      firstName: [data && data.firstName || null, Validators.compose([Validators.required, Validators.minLength(2)])],
      email: [data && data.email || null, Validators.compose([Validators.required, Validators.email])],
      mainProfile: [data && (data.mainProfile || getMainProfile(data.profiles)) || 'GUEST', Validators.required],
      statusId: [data && data.statusId || StatusIds.TEMPORARY, Validators.required],
      pubkey: [data && data.pubkey || null, Validators.compose([Validators.required, SharedValidators.pubkey])]
    };

    // Add additional fields
    this.accountService.additionalFields.forEach(field => {
      //console.debug("[register-form] Add additional field {" + field.name + "} to form", field);
      formDef[field.key] = [data && data[field.key] || null, this.getValidators(field)];
    });

    return formDef;
  }

  getValidators(field: FormFieldDefinition): ValidatorFn | ValidatorFn[] {
    const validatorFns: ValidatorFn[] = [];
    if (field.extra && field.extra.account && field.extra.account.required) {
      validatorFns.push(Validators.required);
    }
    if (field.type === 'entity') {
      validatorFns.push(SharedValidators.entity);
    }

    return validatorFns.length ? Validators.compose(validatorFns) : validatorFns.length === 1 ? validatorFns[0] : undefined;
  }
}
