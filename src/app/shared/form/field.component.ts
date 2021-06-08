import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef, InjectionToken, Injector,
  Input,
  OnInit,
  Optional,
  Output,
  ViewChild
} from '@angular/core';
import {ControlValueAccessor, FormControl, FormGroupDirective, NG_VALUE_ACCESSOR} from '@angular/forms';
import {FloatLabelType} from '@angular/material/form-field';
import {isNilOrBlank, isNotNilOrBlank, joinPropertiesPath, toBoolean} from '../functions';
import {DisplayFn, FormFieldDefinition} from './field.model';
import {TranslateService} from '@ngx-translate/core';
import {getColorContrast} from '../graph/colors.utils';
import {asInputElement, filterNumberInput, selectInputContent} from '../inputs';
import {toDateISOString} from '../dates';

const noop = () => {
};

@Component({
  selector: 'app-form-field',
  styleUrls: ['./field.component.scss'],
  templateUrl: './field.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppFormField),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppFormField implements OnInit, ControlValueAccessor {

  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _definition: FormFieldDefinition;

  type: string;
  numberInputStep: string;

  @Input()
  set definition(value: FormFieldDefinition) {
    if (this._definition === value) return;
    this._definition = value;
    this.type = value && value.type;
    this.cd.markForCheck();
  }

  get definition(): FormFieldDefinition {
    return this._definition;
  }

  @Input() required: boolean;

  @Input() readonly = false;

  @Input() disabled: boolean;

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() compact = false;

  @Input() floatLabel: FloatLabelType = 'auto';

  @Input() tabindex: number;

  @Input('class') classList: string;

  @Output('keyup.enter')
  onKeyupEnter = new EventEmitter<any>();

  get value(): any {
    return this.formControl.value;
  }

  @ViewChild('matInput') matInput: ElementRef;

  constructor(
    protected translate: TranslateService,
    protected cd: ChangeDetectorRef,
    protected injector: Injector,
    @Optional() private formGroupDir: FormGroupDirective
  ) {

  }

  ngOnInit() {

    if (!this._definition) throw new Error('Missing mandatory attribute \'definition\' in <app-form-field>.');
    if (typeof this._definition !== 'object') throw new Error('Invalid attribute \'definition\' in <app-form-field>. Should be an object.');
    if (!this.type) throw new Error('Invalid attribute \'definition\' in <app-form-field>. Missing type !');

    this.checkAndResolveFormControl();

    this.placeholder = this.placeholder || (this._definition.label && this.translate.instant(this._definition.label));
    this.required = toBoolean(this.required, toBoolean(this._definition.required, false));
    this.disabled = toBoolean(this.disabled, toBoolean(this._definition.disabled, false));

    this.updateTabIndex();

    if (this.type === 'double') {
      this.numberInputStep = this.computeNumberInputStep(this._definition);
    } else if (this.type === 'enum' && this._definition.values instanceof InjectionToken) {
      this._definition.values = this.computeValuesFromToken(this._definition.values);
    }
  }

  writeValue(obj: any): void {
    if ((this.type === 'integer' || this.type === 'double') && Number.isNaN(obj)) {
      //console.log("WARN: trying to set NaN value, in a config option field ! " + this.constructor.name);
      obj = null;
    }
    else if (this.type === 'boolean' && typeof obj === 'string') {
      obj = (obj !== 'false');
    }
    else if (this.type === 'date') {
      obj = toDateISOString(obj);
    }
    else if (this.type === 'entity' && isNilOrBlank(obj)) {
      obj = null;
    }
    if (obj !== this.formControl.value) {
      //console.debug("Set config value ", this.formControl.value, obj);
      this.formControl.patchValue(obj, {emitEvent: false});
      this._onChangeCallback(obj);
    }

    this.cd.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.disabled === isDisabled) return;
    this.disabled = isDisabled;
    this.cd.markForCheck();
  }

  public markAsTouched() {
    if (this.formControl.touched) {
      this.cd.markForCheck();
      this._onTouchedCallback();
    }
  }

  filterAlphanumericalInput(event: KeyboardEvent) {
    if (event.keyCode === 13 /*=Enter*/ && this.onKeyupEnter.observers.length) {
      this.onKeyupEnter.emit(event);
      return;
    }
    // Add features (e.g. check against a pattern)
  }

  focus() {
    if (this.matInput) this.matInput.nativeElement.focus();
  }

  filterNumberInput = filterNumberInput;
  selectInputContent = selectInputContent;

  getDisplayValueFn(definition: FormFieldDefinition): DisplayFn {
    if (definition.autocomplete && definition.autocomplete.displayWith) {
      return (obj: any) => definition.autocomplete.displayWith(obj);
    }
    const attributes = definition.autocomplete && definition.autocomplete.attributes || ['label', 'name'];
    return (obj: any) => obj && joinPropertiesPath(obj, attributes);
  }

  getColorContrast(color: string): string | undefined {
    return isNotNilOrBlank(color) ? getColorContrast(color, true) : undefined;
  }

  /* -- protected method -- */

  protected computeNumberInputStep(definition: FormFieldDefinition): string {

    if (definition.maximumNumberDecimals > 0) {
      let step = '0.';
      if (definition.maximumNumberDecimals > 1) {
        for (let i = 0; i < definition.maximumNumberDecimals - 1; i++) {
          step += '0';
        }
      }
      step += '1';
      return step;
    } else {
      return '1';
    }
  }

  protected computeValuesFromToken(token: InjectionToken<any>): any[] {
    const values = this.injector.get(token);
    return values instanceof Array ? values : [];
  }

  protected checkAndResolveFormControl() {
    if (this.formControl) return; // OK, there is a control

    if (this.formGroupDir) {
      // Try to find using definition.key, as formControlName
      if (!this.formControlName && this._definition.key) {
        this.formControlName = this._definition.key;
      }
      const formControlName = (this.formGroupDir.directives || []).find(d => this.formControlName && d.name === this.formControlName);
      this.formControl = formControlName && formControlName.control;
      if (!this.formControl) {
        this.formControl = this.formGroupDir.form.get(this.formControlName) as FormControl;
      }
    }

    if (!this.formControl) {
      throw new Error('Missing attribute \'formControl\' or \'formControlName\' in <app-form-field> component.');
    }
  }

  protected updateTabIndex() {
    if (this.tabindex && this.tabindex !== -1) {
      setTimeout(() => {
        const element = asInputElement(this.matInput);
        if (element) {
          element.tabIndex = this.tabindex;
          this.cd.markForCheck();
        }
      });
    }
  }
}
