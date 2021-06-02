import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  Input, OnDestroy,
  OnInit,
  Optional, Provider,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {Platform} from '@ionic/angular';
import {
  AbstractControl,
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
import {DATE_ISO_PATTERN, DEFAULT_PLACEHOLDER_CHAR, KEYBOARD_HIDE_DELAY_MS} from '../../constants';
import {SharedValidators} from '../../validator/validators';
import {sleep, isNil, isNilOrBlank, toBoolean} from "../../functions";
import {Keyboard} from "@ionic-native/keyboard/ngx";
import {filter, first} from "rxjs/operators";
import {InputElement, setTabIndex} from "../../inputs";
import {BehaviorSubject, Subscription} from "rxjs";
import {FloatLabelType} from "@angular/material/form-field";
import {MatDatepicker, MatDatepickerInputEvent} from "@angular/material/datepicker";
import {DateAdapter} from "@angular/material/core";
import {isFocusableElement} from "../../focusable";
import {toDateISOString} from "../../dates";

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatDate),
  multi: true
};

const DAY_MASK = [/\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/];

const noop = () => {};

@Component({
  selector: 'mat-date-field',
  templateUrl: './material.date.html',
  styleUrls: ['./material.date.scss'],
  providers: [
    DEFAULT_VALUE_ACCESSOR,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatDate implements OnInit, OnDestroy, ControlValueAccessor, InputElement {
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _subscription = new Subscription();
  protected writing = true;
  protected disabling = false;
  protected _tabindex: number;
  protected keyboardHideDelay: number;

  mobile: boolean;
  dayControl: AbstractControl;
  displayPattern: string;
  dayPattern: string;
  _value: Moment;
  locale: string;
  dayMask = DAY_MASK;

  @Input() disabled = false;

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() floatLabel: FloatLabelType = "auto";

  @Input() readonly = false;

  @Input() required: boolean;

  @Input() compact = false;

  @Input() placeholderChar: string = DEFAULT_PLACEHOLDER_CHAR;

  @Input() autofocus = false;

  @Input() set tabindex(value: number) {
    if (this._tabindex !== value) {
      this._tabindex = value;
      setTimeout(() => this.updateTabIndex());
    }
  }

  get tabindex(): number {
    return this._tabindex;
  }

  @Input() startDate: Date;

  @Input() clearable = false;

  @ViewChild('datePicker') datePicker: MatDatepicker<Moment>;

  @ViewChildren('matInput') matInputs: QueryList<ElementRef>;

  get value(): any {
    return toDateISOString(this._value);
  }

  constructor(
    platform: Platform,
    private dateAdapter: DateAdapter<Moment>,
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    @Optional() private keyboard: Keyboard,
    @Optional() private formGroupDir: FormGroupDirective,
  ) {
    // Workaround because ion-datetime has issue (do not returned a ISO date)
    this.mobile = platform.is('mobile');
    this.keyboardHideDelay = this.mobile && KEYBOARD_HIDE_DELAY_MS || 0;

    this.locale = (translate.currentLang || translate.defaultLang).substr(0, 2);
  }

  ngOnInit() {

    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error("Missing mandatory attribute 'formControl' or 'formControlName' in <mat-date-time-field>.");

    this.required = toBoolean(this.required, this.formControl.validator === Validators.required);

    // Redirect errors from main control, into day sub control
    const $error = new BehaviorSubject<ValidationErrors>(null);
    this.dayControl = this.formBuilder.control(null, () => $error.getValue());

    // Add custom 'validDate' validator
    this.formControl.setValidators(this.required ? [Validators.required, SharedValidators.validDate] : SharedValidators.validDate);

    // Get patterns to display date
    this.updatePattern(this.translate.instant('COMMON.DATE_PATTERN'));
    this._subscription.add(
      this.translate.get('COMMON.DATE_PATTERN')
        .subscribe((pattern) => this.updatePattern(pattern))
    );

    this._subscription.add(
      this.dayControl.valueChanges
       .subscribe((value) => this.onFormChange(value)));

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
          this.dayControl.updateValueAndValidity({onlySelf: true, emitEvent: false});
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

    // console.debug('[mat-date] writeValue:', obj);

    if (isNilOrBlank(obj)) {
      this.writing = true;
      this.dayControl.patchValue(null, {emitEvent: false});
      this._value = undefined;
      if (this.formControl.value) {
        this.formControl.patchValue(null, {emitEvent: false});
        this._onChangeCallback(null);
      }
      this.writing = false;
      this.markForCheck();
      return;
    }

    this._value = this.dateAdapter.parse(obj, DATE_ISO_PATTERN);
    if (!this._value) { // invalid date
      return;
    }

    this.writing = true;

    // Set form value
    this.dayControl.patchValue(this.dateAdapter.format(this._value.clone().startOf('day'), this.dayPattern), {emitEvent: false});
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
      this.dayControl.disable({onlySelf: true, emitEvent: false});
    } else {
      this.dayControl.enable({onlySelf: true, emitEvent: false});
    }
    this.disabling = false;

    this.markForCheck();
  }

  onDatePickerChange(event: MatDatepickerInputEvent<Moment>): void {
    if (this.writing || !(event && event.value)) return; // Skip if call by self
    this.writing = true;

    let date = event.value;
    date = typeof date === 'string' && this.dateAdapter.parse(date, DATE_ISO_PATTERN) || date;
    let day;

    // avoid to have TZ offset
    date = date && date.utc(true).hour(0).minute(0).seconds(0).millisecond(0);
    day = date && date.clone().startOf('day');

    // update day value
    this.dayControl.setValue(date && this.dateAdapter.format(day, this.dayPattern), {emitEvent: false});

    // Get the model value
    const dateStr = date && this.dateAdapter.format(date, DATE_ISO_PATTERN).replace('+00:00', 'Z');
    this.formControl.patchValue(dateStr, {emitEvent: false});
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(dateStr);
  }

  private updatePattern(pattern: string) {
    pattern = pattern !== 'COMMON.DATE_PATTERN' ? pattern : 'L';
    if (this.displayPattern !== pattern) {
      this.displayPattern = pattern;
      this.dayPattern = pattern;
      this.markForCheck();
    }
  }

  private onFormChange(dayValue): void {
    if (this.writing) return; // Skip if call by self
    this.writing = true;

    // Make to remove placeholder chars
    while (dayValue && dayValue.indexOf(this.placeholderChar) !== -1) {
      dayValue = dayValue.replace(this.placeholderChar, '');
    }

    let date: Moment;

    // Parse day string
    date = dayValue && this.dateAdapter.parse(dayValue, this.dayPattern) || null;

    // Reset time
    date = date && date.utc(true).hour(0).minute(0).seconds(0).millisecond(0);

    // update date picker
    this._value = date && this.dateAdapter.parse(date.clone(), DATE_ISO_PATTERN);

    // Get the model value
    const dateStr = date && date.isValid() && this.dateAdapter.format(date, DATE_ISO_PATTERN).replace('+00:00', 'Z') || date;
    //console.debug("[mat-date-time] Setting date: ", dateStr);
    this.formControl.patchValue(dateStr, {emitEvent: false});
    //this.formControl.updateValueAndValidity();
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(dateStr);
  }



  checkIfTouched() {
    if (this.dayControl.touched) {
      this.markForCheck();
      this._onTouchedCallback();
    }
  }

  async openDatePickerIfMobile(event: UIEvent, datePicker?: MatDatepicker<any>) {
    if (!this.mobile || event.defaultPrevented) return;

    this.preventEvent(event);

    // Make sure the keyboard is closed
    await this.waitKeyboardHide(false);

    // Open the picker
    this.openDatePicker(null, datePicker);
  }

  public openDatePicker(event?: UIEvent, datePicker?: MatDatepicker<any>) {
    datePicker = datePicker || this.datePicker;
    if (datePicker) {

      if (event) this.preventEvent(event);

      if (!datePicker.opened) {
        datePicker.open();
      }
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

  /* -- protected method -- */

  protected async waitKeyboardHide(waitKeyboardDelay: boolean) {

    if (!this.keyboard || !this.keyboard.isVisible) return; // ok, already hidden (or not accessible)

    // Force keyboard to be hide
    this.keyboard.hide();

    // Wait hide occur
    await this.keyboard.onKeyboardHide().pipe(first()).toPromise();

    // Wait an additional delay if need (depending on the OS)
    if (this.keyboardHideDelay > 0 && waitKeyboardDelay) {
      await sleep(this.keyboardHideDelay);
    }
  }

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

