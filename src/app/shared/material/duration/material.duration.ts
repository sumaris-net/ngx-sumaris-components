import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Optional, Provider,
  QueryList,
  ViewChildren
} from '@angular/core';
import {Platform} from '@ionic/angular';
import {DateAdapter} from '@angular/material/core';
import {FloatLabelType} from '@angular/material/form-field';
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroupDirective,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validators
} from "@angular/forms";
import {TranslateService} from "@ngx-translate/core";
import {Moment} from "moment";
import {DEFAULT_PLACEHOLDER_CHAR} from '../../constants';
import {isNil, toBoolean} from "../../functions";
import {InputElement, moveInputCaretToSeparator, setTabIndex} from "../../inputs";
import {isFocusableElement} from "../../focusable";
import {DEFAULT_MAX_DECIMALS, formatDuration, parseDuration} from "./duration.utils";
import {BehaviorSubject, Subscription} from "rxjs";
import {filter} from "rxjs/operators";

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatDuration),
  multi: true
};

const HOUR_TIME_PATTERN = /[0-9]\d\d:[0-5]\d/;
const HOUR_MASK = [/\d/, /\d/, /\d/, ':', /[0-5]/, /\d/];

const noop = () => {
};

@Component({
  selector: 'mat-duration-field',
  templateUrl: './material.duration.html',
  styleUrls: ['./material.duration.scss'],
  providers: [
    DEFAULT_VALUE_ACCESSOR,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatDuration implements OnInit, OnDestroy, ControlValueAccessor, InputElement {
  private _subscription = new Subscription();
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  protected writing = true;
  protected disabling = false;
  protected _tabindex: number;

  textControl: FormControl;
  _value: number;
  hourMask = HOUR_MASK;

  @Input() disabled = false;

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() floatLabel: FloatLabelType = "auto";

  @Input() readonly = false;

  @Input() required: boolean;

  @Input() compact = false;

  @Input() maxDecimals: number = DEFAULT_MAX_DECIMALS;

  @Input() placeholderChar: string = DEFAULT_PLACEHOLDER_CHAR;

  @Input() set tabindex(value: number) {
    if (this._tabindex !== value) {
      this._tabindex = value;
      setTimeout(() => this.updateTabIndex());
    }
  }

  get tabindex(): number {
    return this._tabindex;
  }

  @Input() clearable = false;

  @ViewChildren('matInput') matInputs: QueryList<ElementRef>;

  get value(): any {
    return this._value;
  }

  constructor(
    platform: Platform,
    private dateAdapter: DateAdapter<Moment>,
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective,
  ) {
  }

  ngOnInit() {

    if (this.maxDecimals) {
      if (this.maxDecimals < 0) {
        console.error("Invalid attribute 'maxDecimals'. Must a positive value.");
        this.maxDecimals = DEFAULT_MAX_DECIMALS;
      }
      else if (this.maxDecimals < DEFAULT_MAX_DECIMALS) {
        console.warn(`Invalid attribute 'maxDecimals' - Value should be more than ${DEFAULT_MAX_DECIMALS}, otherwise the round trip conversion will lose minutes.`);
        this.maxDecimals = DEFAULT_MAX_DECIMALS;
      }
    }

    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error("Missing mandatory attribute 'formControl' or 'formControlName' in <mat-date-time-field>.");

    this.required = toBoolean(this.required, this.formControl.validator === Validators.required);

    // Redirect errors from main control, into day sub control
    const $error = new BehaviorSubject<ValidationErrors>(null);
    this.textControl = this.formBuilder.control(null, null);
    this.textControl.setValidators(this.required ? [Validators.required, () => $error.getValue(), Validators.pattern(HOUR_TIME_PATTERN)] :
      [() => $error.getValue(), Validators.pattern(HOUR_TIME_PATTERN)]);

    this._subscription.add(
      this.textControl.valueChanges
        .subscribe((value) => this.onFormChange(value))
    );

    // Listen status changes outside the component (e.g. when setErrors() is calling on the formControl)
    this._subscription.add(
      this.formControl.statusChanges
        .pipe(filter(() => !this.readonly && !this.writing && !this.disabling)) // Skip
        .subscribe((status) => {
          if (status === 'INVALID') {
            $error.next(this.formControl.errors);
          }
          else if (status === 'VALID') {
            $error.next(null);
          }
          this.textControl.updateValueAndValidity({onlySelf: true, emitEvent: false});
          this.markForCheck();
        }));

    this.updateTabIndex();

    this.writing = false;
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  writeValue(obj: any): void {
    if (this.writing) return;

    // console.debug('[mat-duration] writeValue:', obj);

    if (isNil(obj)) {
      this.writing = true;
      this.textControl.patchValue(null, {emitEvent: false});
      this._value = undefined;
      if (this.formControl.value) {
        this.formControl.patchValue(null, {emitEvent: false});
        this._onChangeCallback(null);
      }
      this.writing = false;
      this.markForCheck();
      return;
    }

    this._value = obj;
    if (isNaN(this._value)) { // invalid value
      return;
    }

    this.writing = true;

    console.debug(`[mat-duration] Formatted hour: ${this._value} to ${formatDuration(this._value)}`);

    // Set form value
    this.textControl.patchValue(formatDuration(this._value), {emitEvent: false});
    this.writing = false;
    this.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.disabling) return;

    this.disabling = true;
    this.disabled = isDisabled;
    if (isDisabled) {
      this.textControl.disable({onlySelf: true, emitEvent: false});
    } else {
      this.textControl.enable({onlySelf: true, emitEvent: false});
    }
    this.disabling = false;

    this.markForCheck();
  }

  private onFormChange(value): void {
    if (this.writing) return; // Skip if call by self
    this.writing = true;

    console.debug('[mat-duration] onFormChange:', value);

    if (this.textControl.hasError('pattern') || this.textControl.hasError('required')) {
      this.formControl.markAsPending();
      this.formControl.setErrors({
        pattern: this.textControl.errors.pattern,
        required: this.textControl.errors.required
      });
      this.writing = false;
      return;
    }

    this._value = parseDuration(value || '', this.maxDecimals, this.placeholderChar);

    console.debug("[mat-duration] Setting duration: ", this._value);
    this.formControl.patchValue(this._value, {emitEvent: false});
    //this.formControl.updateValueAndValidity();
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(this._value);
  }

  checkIfTouched() {
    if (this.textControl.touched) {
      this.markForCheck();
      this._onTouchedCallback();
    }
  }

  preventEvent(event: UIEvent) {
    if (!event) return;
    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    event.returnValue = false;
  }

  focus() {
    if (!this.matInputs.length) return;

    setTimeout(() => {
      const elementRef = this.matInputs[0]; // get the first element
      if (isFocusableElement(elementRef)) {
        elementRef.focus();
      }
    });
  }

  moveCaretToSeparator(event: any, forward: boolean): boolean {
    // Move to the next separator
    return moveInputCaretToSeparator(event, ':', forward);
  }

  /* -- protected method -- */

  protected updateTabIndex() {
    if (isNil(this._tabindex) || this._tabindex === -1) return; // skip

    // Focus to first input
    setTimeout(() => {
      this.matInputs.forEach((elementRef, index) => {
        setTabIndex(elementRef, this._tabindex + index);
      });
      this.markForCheck();
    });
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}

