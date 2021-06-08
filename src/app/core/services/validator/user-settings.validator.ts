import {Injectable} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {UserSettings} from '../model/settings.model';
import {AppValidatorService} from './base.validator.class';

@Injectable({providedIn: 'root'})
export class UserSettingsValidatorService extends AppValidatorService<UserSettings> {

  constructor(
    formBuilder: FormBuilder
  ) {
    super(formBuilder);
  }

  getFormGroup(data?: UserSettings): FormGroup {
    return this.formBuilder.group({
      id: [data && data.id || null],
      updateDate: [data && data.updateDate || null],
      locale: [data && data.locale || null, Validators.required],
      latLongFormat: [data && data.latLongFormat || null, Validators.required],
      content: this.formBuilder.group({
      //usageMode: [data && data.content && data.content.usageMode || 'DESK', Validators.required],
      }),
      nonce: [data && data.nonce || null]
    });
  }
}
