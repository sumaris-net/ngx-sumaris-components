import {Injectable} from '@angular/core';
import {AbstractControlOptions, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Referential} from '../model/referential.model';
import {AppValidatorService} from '../validator/base.validator.class';
import {StatusIds} from '../model/model.enum';

@Injectable()
export class ReferentialValidatorService<T extends Referential = Referential>
  extends AppValidatorService<T> {

  constructor(protected formBuilder: FormBuilder) {
    super(formBuilder);
  }

  getRowValidator(): FormGroup {
    return this.getFormGroup();
  }

  getFormGroup(data?: T, opts?: {
    withDescription?: boolean;
    withComments?: boolean;
  }): FormGroup {
    return this.formBuilder.group(
      this.getFormGroupConfig(data, opts),
      this.getFormGroupOptions(data, opts)
    );
  }

  getFormGroupConfig(data?: T, opts?: {
    withDescription?: boolean;
    withComments?: boolean;
  }): {[key: string]: any} {
    const controlsConfig: {[key: string]: any} = {
      id: [data && data.id || null],
      updateDate: [data && data.updateDate || null],
      creationDate: [data && data.creationDate || null],
      statusId: [data && data.statusId || null, Validators.required],
      levelId: [data && data.levelId || null],
      label: [data && data.label || null, Validators.required],
      name: [data && data.name || null, Validators.required],
      entityName: [data && data.entityName || null, Validators.required]
    };

    if (!opts || opts.withDescription !== false) {
      controlsConfig.description = [data && data.description || null, Validators.maxLength(255)];
    }
    if (!opts || opts.withComments !== false) {
      controlsConfig.comments = [data && data.comments || null, Validators.maxLength(2000)];
    }

    return controlsConfig;
  }

  getFormGroupOptions(data?: T, opts?: any): AbstractControlOptions | null {
    return null;
  }
}
