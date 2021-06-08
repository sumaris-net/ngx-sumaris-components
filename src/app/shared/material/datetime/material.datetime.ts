import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Optional, Provider,
  QueryList,
  ViewChild,
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
  Validators
} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {isMoment, Moment} from 'moment';
import {DEFAULT_PLACEHOLDER_CHAR, KEYBOARD_HIDE_DELAY_MS} from '../../constants';
import {SharedValidators} from '../../validator/validators';
import {Keyboard} from '@ionic-native/keyboard/ngx';
import {filter, first} from 'rxjs/operators';
import {InputElement, setTabIndex} from '../../inputs';
import {isFocusableElement} from '../../focusable';
import {merge, Subscription} from 'rxjs';
import {MatDatepicker, MatDatepickerInputEvent} from '@angular/material/datepicker';
import {isNil, isNilOrBlank, sleep, toBoolean} from '../../functions';
import {fromDateISOString, toDateISOString} from '../../dates';

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatDateTime),
  multi: true
};

const DAY_MASK = [/\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/];

const HOUR_REGEXP = /^[012][0-9][:][012345][0-9]$/;
const HOUR_MASK = [/[012]/, /\d/, ':', /[012345]/, /\d/];

const noop = () => {
};

declare interface NgxTimePicker {
  selectedHour: { time: number };
  selectedMinute: { time: number };
  open();
  close();
}

@Component({
  selector: 'mat-date-time-field',
  templateUrl: './material.datetime.html',
  styleUrls: ['./material.datetime.scss'],
  providers: [
    DEFAULT_VALUE_ACCESSOR,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatDateTime implements OnInit, OnDestroy, ControlValueAccessor, InputElement {
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _subscription = new Subscription();
  protected writing = true;
  protected disabling = false;
  protected _tabindex: number;
  protected _onDestroy = new EventEmitter<any>();
  protected waitHideKeyboardDelay: number;

  dateFormControl: FormControl;
  timeFormControl: FormControl;
  displayPattern: string;
  dayPattern: string;
  locale: string;
  readonly dayMask = DAY_MASK;
  readonly hourMask = HOUR_MASK;

  @Input() mobile: boolean;

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() floatLabel: FloatLabelType = 'auto';

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

  get value(): any {
    return this.formControl.value;
  }

  @Input() startDate: Date;

  @Input() clearable = false;

  @ViewChild('datePicker') datePicker: MatDatepicker<Moment>;
  @ViewChild('timePicker') timePicker: NgxTimePicker;

  @ViewChildren('matInput') matInputs: QueryList<ElementRef>;

  constructor(
    private platform: Platform,
    private dateAdapter: DateAdapter<Moment>,
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private keyboard: Keyboard,
    private cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective,
  ) {
    this.locale = (translate.currentLang || translate.defaultLang).substr(0, 2);
  }

  ngOnInit() {

    this.mobile = isNil(this.mobile) ? this.platform.is('mobile') : this.mobile;
    this.waitHideKeyboardDelay = this.mobile && KEYBOARD_HIDE_DELAY_MS || 0;

    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-date-time-field>.');

    this.required = toBoolean(this.required, this.formControl.validator === Validators.required);

    // Add 'validDate' validator (when existing validator are null or required, to be sure to keep it)
    if (!this.formControl.validator || this.formControl.validator === Validators.required) {
      this.formControl.setValidators(this.required ? [Validators.required, SharedValidators.validDate] : SharedValidators.validDate);
    }
    else {
      this.formControl.setValidators(this.required ? [this.formControl.validator, Validators.required, SharedValidators.validDate] :
        [this.formControl.validator, SharedValidators.validDate]);
    }

    // Create the date control
    this.dateFormControl = this.formBuilder.control(null,
      this.required ? Validators.required : null
    );

    // Create the time control
    const timeValidator = this.required ?
      (this.mobile ? Validators.required : Validators.compose([Validators.required, Validators.pattern(HOUR_REGEXP)])) :
      (this.mobile ? null : Validators.pattern(HOUR_REGEXP));
    this.timeFormControl = this.formBuilder.control(null, timeValidator);

    // Get patterns to display date and date+time
    this._subscription.add(
        this.translate.get(['COMMON.DATE_PATTERN', 'COMMON.DATE_TIME_PATTERN'])
            .subscribe((patterns) => this.updatePattern(patterns))
    );

    this._subscription.add(
      merge(
        this.dateFormControl.valueChanges,
        this.timeFormControl.valueChanges
      )
        .subscribe((event) => this.onFormChange(event))
    );

    // Listen status changes (when done outside the component  - e.g. when setErrors() is calling on the formControl)
    this._subscription.add(
      this.formControl.statusChanges
        .pipe(
          filter((_) => !this.readonly && !this.writing && !this.disabling) // Skip
        )
        .subscribe(() => this.markForCheck())
    );

    this.updateTabIndex();

    this.writing = false;
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
    this._onDestroy.emit();
  }

  writeValue(valueStr: any): void {
    if (this.writing) return; // Skip
    this.writing = true;

    // DEBUG
    // console.debug("[mat-date-time] writeValue() with:", valueStr);

    const value = fromDateISOString(valueStr);

    if (!value || !value.isValid()) {
      this.dateFormControl.patchValue(null, {emitEvent: false});
      this.timeFormControl.patchValue(null, {emitEvent: false});
    }
    else {
      // Parse day
      const day = value.clone().startOf('day');
      const dayStr = this.dateAdapter.format(day, this.dayPattern);

      // Parse time
      // - Format hh
      let hour: number | string = value.hour();
      hour = hour < 10 ? ('0' + hour) : hour;
      // - Format mm
      let minutes: number | string = value.minutes();
      minutes = minutes < 10 ? ('0' + minutes) : minutes;
      const timeStr = `${hour}:${minutes}`;

      // Update controls
      this.dateFormControl.patchValue(dayStr, {emitEvent: false});
      this.timeFormControl.patchValue(timeStr, {emitEvent: false});
    }

    this.writing = false;
    this.markForCheck();
  }

  private onFormChange(event?: any) {
    if (this.writing) return; // Skip if call by self
    this.writing = true;

    let dayStr = this.dateFormControl.value;
    const time = this.timeFormControl.value;

    // DEBUG
    //console.debug(`[mat-date-time] onFormChange() from event: ${event} - controls values: `, [dayStr, time]);

    const incompleteValue = isNilOrBlank(time) !== isNilOrBlank(dayStr);
    if (incompleteValue || this.dateFormControl.invalid || this.timeFormControl.invalid) {
      this.formControl.markAsPending({onlySelf: true});
      this.formControl.setErrors({
        validDate: incompleteValue,
        ...this.formControl.errors,
        ...this.dateFormControl.errors,
        ...this.timeFormControl.errors
      });
      this.formControl.markAsDirty();
      // Reset the value
      //this.emitChange(null);
      this.writing = false;
      return;
    }


    // Make to remove placeholder chars
    while (dayStr && dayStr.indexOf(this.placeholderChar) !== -1) {
      dayStr = dayStr.replace(this.placeholderChar, '');
    }

    // Parse day
    const day: Moment = dayStr && this.dateAdapter.parse(dayStr, this.dayPattern) || null;

    // Parse time
    const hourParts = (time || '').split(':');
    const hour = parseInt(hourParts[0] || 0);
    const minutes = parseInt(hourParts[1] || 0);
    const dateTime = day && day
      .locale(this.locale) // set as time as locale time
      .hour(hour).minute(minutes)// Set local hour
      .seconds(0).millisecond(0) // Reset seconds/millisecond
      .utc(); // Convert to UTC (avoid TZ offset in final string)

    // Set model value
    this.emitChange(dateTime);
    this.writing = false;
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.disabling) return; // Skip

    this.disabling = true;
    if (isDisabled) {
      this.dateFormControl.disable({emitEvent: false});
      this.timeFormControl.disable({emitEvent: false});
    } else {
      this.dateFormControl.enable({emitEvent: false});
      this.timeFormControl.enable({emitEvent: false});
    }
    this.disabling = false;

    this.markForCheck();
  }

  private updatePattern(patterns: {[key: string]: string}) {
    this.displayPattern = (patterns['COMMON.DATE_TIME_PATTERN'] !== 'COMMON.DATE_TIME_PATTERN' ? patterns['COMMON.DATE_TIME_PATTERN'] : 'L LT');
    this.dayPattern = (patterns['COMMON.DATE_PATTERN'] !== 'COMMON.DATE_PATTERN' ? patterns['COMMON.DATE_PATTERN'] : 'L');
  }

  onDatePickerChange(event: MatDatepickerInputEvent<Moment>): void {
    // Make sure event is valid
    if (!event || (event.value !== null && !isMoment(event.value))) {
      console.warn('Invalid MatDatepicker event. Skipping', event);
      return; // Skip
    }

    // Convert to usable date, then convert to day pattern (e.g DD/MM/YYYY)
    const day = event.value && event.value
      .locale(this.locale) // set as time as locale time
      .hour(0).minute(0).seconds(0).millisecond(0) // Reset hour
      .utc(true);
    const dayStr = day && this.dateAdapter.format(day, this.dayPattern) || null;

    // Update the day control
    if (this.dateFormControl.value !== dayStr) {

      // DEBUG
      // console.debug("[mat-date-time] onDatePickerChange() new value:", dayStr);

      this.dateFormControl.setValue(dayStr, {
        emitEvent: true // Will call onFormChange
      });
    }
  }


  onTimePickerChange(timeStr: string) {
    // Update the time control, if need
    if (this.timeFormControl.value !== timeStr) {

      // DEBUG
      // console.debug("[mat-date-time] onTimePickerChange() new value:", timeStr);

      this.timeFormControl.setValue(timeStr, {
        emitEvent: true // Will call onFormChange
      });
    }

  }

  async openDatePickerIfMobile(event: UIEvent, datePicker?: MatDatepicker<any>) {
    if (!this.mobile || event.defaultPrevented) return;

    this.preventEvent(event);

    // Make sure the keyboard is closed
    await this.hideKeyboard(false);

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

  async openTimePickerIfMobile(event: UIEvent) {
    if (!this.mobile || event.defaultPrevented) return;

    this.preventEvent(event);

    // Make sure the keyboard is closed
    await this.hideKeyboard(true);

    // Open the picker
    this.openTimePicker(null);
  }

  openTimePicker(event: UIEvent) {
    if (!this.timePicker) return; // Skip

    this.preventEvent(event);

    this.timePicker.open();
  }

  preventEvent(event: UIEvent) {
    if (!event) return;
    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    event.returnValue = false;
  }

  checkIfTouched() {
    if (this.dateFormControl.touched || this.timeFormControl.touched) {
      this._onTouchedCallback();
      this.markForCheck();
    }
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

  clear() {
    this.formControl.setValue(null);
    this.markAsTouched();
    this.markAsDirty();
  }

  /* -- protected method -- */

  protected emitChange(value: Moment) {

    // Get the model value
    const dateStr = toDateISOString(value) || null;


    if (this.formControl.value !== dateStr) {

      // DEBUG
      //console.debug('[matèdate-time] Emit new value: ' + dateStr);

      // Changes comes from inside function: use the callback
      this._onChangeCallback(dateStr);

      // Check if need to update controls
      this.checkIfTouched();
    }
  }

  protected async hideKeyboard(waitIsHidden: boolean) {

    if (!this.keyboard.isVisible) return; // ok, already hidden

    // Force keyboard to be hide
    this.keyboard.hide();

    // Wait hide occur
    await this.keyboard.onKeyboardHide().pipe(first()).toPromise();

    // Wait an additional delay if need (depending on the OS)
    if (this.waitHideKeyboardDelay > 0 && waitIsHidden) {
      await sleep(this.waitHideKeyboardDelay);
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

  protected markAsTouched() {
    this.dateFormControl.markAsTouched();
    this.timeFormControl.markAsTouched();
    this._onTouchedCallback();
    this.markForCheck();
  }

  protected markAsDirty(opts?: any) {
    this.formControl.markAsDirty(opts);
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

