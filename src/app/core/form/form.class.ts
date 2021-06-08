import {Directive, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {Moment} from 'moment';
import {DateAdapter} from '@angular/material/core';
import {Subscription} from 'rxjs';
import {DateFormatPipe} from '../../shared/pipes/date-format.pipe';
import {AppFormUtils, IAppForm} from './form.utils';
import {LocalSettingsService} from '../services/local-settings.service';
import {
  MatAutocompleteConfigHolder, MatAutocompleteFieldAddOptions,
  MatAutocompleteFieldConfig
} from '../../shared/material/autocomplete/material.autocomplete';

@Directive()
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export abstract class AppForm<T> implements IAppForm, OnInit, OnDestroy {

  private _subscription = new Subscription();
  private _form: FormGroup;
  protected _enable = false;

  autocompleteHelper: MatAutocompleteConfigHolder;
  autocompleteFields: {[key: string]: MatAutocompleteFieldConfig};
  error: string = null;
  tabGroupAnimationDuration = '200ms';

  @Input() debug = false;
  @Input() tabindex: number;

  get value(): any {
    return this.form.value;
  }

  set value(data: any) {
    this.setValue(data);
  }

  get dirty(): boolean {
    return this.form && this.form.dirty;
  }

  get invalid(): boolean {
    return !this.form || this.form.invalid;
  }

  get pending(): boolean {
    return !this.form || (this.form.dirty && this.form.pending);
  }

  get valid(): boolean {
    return this.form && this.form.valid;
  }

  get empty(): boolean {
    return !this.form || (!this.form.dirty && !this.form.touched);
  }

  get untouched(): boolean {
    return !this.form || this.form.untouched;
  }

  get enabled(): boolean {
    return this._enable;
  }

  get disabled(): boolean {
    return !this._enable;
  }

  disable(opts?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }): void {
    this.form && this.form.disable(opts);
    if (this._enable || (opts && opts.emitEvent)) {
      this._enable = false;
      this.markForCheck();
    }
  }

  enable(opts?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }): void {
    this.form && this.form.enable(opts);
    if (!this._enable || (opts && opts.emitEvent)) {
      this._enable = true;
      this.markForCheck();
    }
  }

  @Input()
  set form(value: FormGroup) {
    this.setForm(value);
  }

  get form(): FormGroup {
    return this._form;
  }

  @Output()
  onCancel = new EventEmitter<any>();

  @Output()
  onSubmit = new EventEmitter<any>();

  protected constructor(
    protected dateAdapter: DateAdapter<Moment> | DateFormatPipe,
    form?: FormGroup,
    protected settings?: LocalSettingsService
  ) {
    if (form) this.setForm(form);
    this.autocompleteHelper = new MatAutocompleteConfigHolder(settings && {
      getUserAttributes: (a, b) => settings.getFieldDisplayAttributes(a, b)
    });
    this.autocompleteFields = this.autocompleteHelper.fields;
  }

  ngOnInit() {
    this._enable ? this.enable() : this.disable();
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
    this.onCancel.complete();
    this.onCancel.unsubscribe();
    this.onSubmit.complete();
    this.onSubmit.unsubscribe();
  }

  cancel() {
    this.onCancel.emit();
  }

  doSubmit(event: any) {
    if (!this.form || !this.form.valid) {
      this.markAsTouched({emitEvent: true});
      return;
    }
    this.onSubmit.emit(event);
  }

  setForm(form: FormGroup) {
    if (this._form !== form) {
      this._form = form;
      this._subscription.add(
        this._form.statusChanges.subscribe(status => this.markForCheck()));
    }
  }

  setValue(data: T, opts?: {emitEvent?: boolean; onlySelf?: boolean }) {
    if (!data) {
      console.warn('[form] Trying to set an empty value to form. Skipping');
      return;
    }

    if (this.debug) console.debug('[form] Updating form (using entity)', data);

    // Convert object to json, then apply it to form (e.g. convert 'undefined' into 'null')
    AppFormUtils.copyEntity2Form(data, this.form, {emitEvent: false, onlySelf: true, ...opts});

    // Only mark for check if 'emitEvent' is set to true.
    // Please note that Reactive Form use 'emitEvent=true' as default value
    if (opts && opts.emitEvent === true) {
      // TODO - BL 13/12/19 : this should not be necessary anymore ?
      this.markForCheck();
    }
  }

  reset(data?: T, opts?: {emitEvent?: boolean; onlySelf?: boolean }) {
    if (data) {
      if (this.debug) console.debug('[form] Resetting form (using entity)', data);

      // Convert object to json, then apply it to form (e.g. convert 'undefined' into 'null')
      const json = AppFormUtils.getFormValueFromEntity(data, this.form);
      this.form.reset(json, {emitEvent: false, onlySelf: true});
    }
    else {
      this.form.reset(null, {emitEvent: false, onlySelf: true});
    }

    // Only mark for check if 'emitEvent' is set to true.
    // Please note that Reactive Form use 'emitEvent=true' as default value
    if (opts && opts.emitEvent === true) {
      this.markForCheck();
    }
  }

  markAsPristine(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    this.form.markAsPristine(opts);
    this.markForCheck();
  }

  markAsUntouched(opts?: {onlySelf?: boolean }) {
    this.form.markAsUntouched(opts);
    this.markForCheck();
  }

  markAsTouched(opts?: {onlySelf?: boolean; emitEvent?: boolean }) {
    // this.form.markAllAsTouched() // This is not working well (e.g. in TripForm)
    AppFormUtils.markAsTouched(this.form, opts);
    this.markForCheck();
  }

  markAsDirty(opts?: {
    onlySelf?: boolean;
  }) {
    this.form.markAsDirty(opts);
    this.markForCheck();
  }

  updateValueAndValidity(opts?: {
    onlySelf?: boolean;
    emitEvent?: boolean;
  }) {
    AppFormUtils.updateValueAndValidity(this.form, opts);
    this.markForCheck();
  }

  /* -- protected methods -- */


  protected registerSubscription(sub: Subscription): Subscription {
    return this._subscription.add(sub);
  }

  protected registerAutocompleteField<T = any, F = any>(fieldName: string,
                                                        opts?: MatAutocompleteFieldAddOptions<T, F>): MatAutocompleteFieldConfig<T, F> {
    return this.autocompleteHelper.add(fieldName, opts);
  }

  protected markForCheck() {
    // Should be override by subclasses
    console.warn('markForCheck() has been called, but is not overwritten by component ' + this.constructor.name);
  }

}
