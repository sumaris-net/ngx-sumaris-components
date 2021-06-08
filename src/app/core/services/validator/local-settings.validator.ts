import {Injectable} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators} from '@angular/forms';
import {EntityUtils} from '../model/entity.model';
import {LocalSettings} from '../model/settings.model';
import {SharedValidators} from '../../../shared/validator/validators';
import {NetworkService} from '../network.service';
import {AppValidatorService} from './base.validator.class';

@Injectable({providedIn: 'root'})
export class LocalSettingsValidatorService extends AppValidatorService<LocalSettings> {

  constructor(
    formBuilder: FormBuilder,
    private networkService: NetworkService
  ) {
    super(formBuilder);
  }

  getFormGroup(data?: LocalSettings): FormGroup {
    return this.formBuilder.group({
      accountInheritance: [data && data.accountInheritance || true, Validators.required],
      locale: [data && data.locale || null, Validators.required],
      latLongFormat: [data && data.latLongFormat || null, Validators.required],
      usageMode: [data && data.usageMode || 'DESK', Validators.required],
      peerUrl: [data && data.peerUrl, Validators.required],
      properties: this.getPropertiesArray(data && data.properties)
    }, {
      asyncValidators: (group: FormGroup) => this.peerAlive(group.get('peerUrl'))
    });
  }

  getPropertiesArray(array?: any) {
    const properties = EntityUtils.getMapAsArray(array || {});
    return this.formBuilder.array(
      properties.map(item => this.getPropertyFormGroup(item))
    );
  }

  getPropertyFormGroup(data?: {key: string; value?: string}): FormGroup {
    return this.formBuilder.group({
      key: [data && data.key || null, Validators.compose([Validators.required, Validators.max(50)])],
      value: [data && data.value || null, Validators.compose([Validators.required, Validators.max(100)])]
    });
  }

  /* -- protected methods -- */

  protected async peerAlive(peerUrlControl: AbstractControl): Promise<ValidationErrors | null>  {

    // Offline mode: no error
    if (this.networkService.offline) {
      SharedValidators.clearError(peerUrlControl, 'peerAlive');
    }
    else {
      const alive = await this.networkService.checkPeerAlive(peerUrlControl.value);
      // KO: add a validation error
      if (!alive) {
        const errors: ValidationErrors = peerUrlControl.errors || {};
        errors['peerAlive'] = true;
        peerUrlControl.setErrors(errors);
        peerUrlControl.markAsTouched({onlySelf: true});
        // Return the error (should be apply to the parent form)
        return { peerAlive: true};
      }
      // OK: remove the existing on control
      else {
        SharedValidators.clearError(peerUrlControl, 'peerAlive');
      }
    }
  }

}
