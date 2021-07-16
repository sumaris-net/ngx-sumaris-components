import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, Input, OnInit, Optional} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, FormGroupDirective, Validators} from '@angular/forms';
import {EntityUtils} from '../services/model/entity.model';
import {FormFieldDefinition, FormFieldDefinitionMap} from '../../shared/form/field.model';
import {isEmptyArray, isNil} from '../../shared/functions';
import {DateAdapter} from '@angular/material/core';
import {Moment} from 'moment';
import {LocalSettingsService} from '../services/local-settings.service';
import {AppForm} from './form.class';
import {FormArrayHelper, FormArrayHelperOptions} from './form.utils';
import {Property} from '../../shared/types';

@Component({
  selector: 'app-properties-form',
  templateUrl: 'properties.form.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppPropertiesForm<T = Property> extends AppForm<T[]> implements OnInit {


  loading = true;
  definitionsMapByKey: FormFieldDefinitionMap = {};
  definitionsByIndex: { [index: number]: FormFieldDefinition } = {};
  helper: FormArrayHelper<Property>;

  @Input() formArrayName: string;

  @Input() formArray: FormArray;

  @Input() options: FormArrayHelperOptions;

  @Input() definitions: FormFieldDefinition[];

  set value(data: T[]) {
    this.setValue(data);
  }

  get value(): T[] {
    return this.formArray.value as T[];
  }

  get fieldForms(): FormGroup[] {
    return this.formArray.controls as FormGroup[];
  }

  constructor(
    protected injector: Injector,
    protected formBuilder: FormBuilder,
    protected dateAdapter: DateAdapter<Moment>,
    protected settings: LocalSettingsService,
    protected cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
    super(dateAdapter,
      null,
      settings);

    //this.debug = !environment.production;
  }

  ngOnInit() {
    if (isEmptyArray(this.definitions)) {
      throw new Error('Missing or invalid attribute \'definitions\'');
    }

    // Fill options map
    this.definitionsMapByKey = {};
    this.definitions.forEach(o => {
      this.definitionsMapByKey[o.key] = o;
    });

    // Retrieve the form
    const form = (this.formArray && this.formArray.parent as FormGroup || this.formGroupDir && this.formGroupDir.form || this.formBuilder.group({}));
    this.setForm(form);

    this.formArray = this.formArray || this.formArrayName && form.get(this.formArrayName) as FormArray;
    this.formArrayName = this.formArrayName || this.formArray && Object.keys(form.controls).find(key => form.get(key) === this.formArray) || 'properties';
    if (!this.formArray) {
      console.warn(`Missing array control '${this.formArrayName}'. Will create it!`);
      this.formArray = this.formBuilder.array([]);
      this.form.addControl(this.formArrayName, this.formArray);
    }

    this.helper = new FormArrayHelper<Property>(
      this.formArray,
      (value) => this.getPropertyFormGroup(value),
      (v1, v2) => (!v1 && !v2) || v1.key === v2.key,
      (value) => isNil(value) || (isNil(value.key) && isNil(value.value)),
      this.options
    );

    super.ngOnInit();
  }

  getDefinitionAt(index: number): FormFieldDefinition {
    let definition = this.definitionsByIndex[index];
    if (!definition) {
      definition = this.updateDefinitionAt(index);
      this.definitionsByIndex[index] = definition;
    }
    return definition;
  }

  updateDefinitionAt(index: number): FormFieldDefinition {
    const key = (this.formArray.at(index) as FormGroup).controls.key.value;
    const definition = key && this.definitionsMapByKey[key] || null;
    this.definitionsByIndex[index] = definition; // update map by index
    this.markForCheck();
    return definition;
  }

  removeAt(index: number) {
    this.helper.removeAt(index);
    this.definitionsByIndex = {}; // clear map by index
    this.markForCheck();
  }

  isUnknownField(fieldForm: FormGroup) {
    const keyControl = fieldForm.get('key');
    const key = keyControl && keyControl.value;
    return key && isNil(this.definitionsMapByKey[key]);
  }

  setValue(data: T[] | any) {
    if (!data) return; // Skip

    // Transform properties map into array
    const values = EntityUtils.getMapAsArray<T>(data);
    this.helper.resize(values.length);
    this.helper.formArray.patchValue(values, {emitEvent: false});

    this.markAsPristine();
    this.loading = false;
  }

  /* -- protected methods -- */

  protected getPropertyFormGroup(data?: {key: string; value?: string}): FormGroup {
    return this.formBuilder.group({
      key: [data && data.key || null, Validators.compose([Validators.required, Validators.max(50)])],
      value: [data && data.value || null, Validators.required]
    });
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

