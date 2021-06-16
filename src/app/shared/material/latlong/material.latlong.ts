import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {Platform} from '@ionic/angular';
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
import {SharedValidators} from '../../validator/validators';
import {
  formatLatitude,
  formatLongitude, LAT_LONG_DEFAULT_MAX_DECIMALS,
  LatLongFormatFn,
  LatLongFormatOptions,
  LatLongPattern,
  parseLatitudeOrLongitude
} from './latlong.utils';
import {DEFAULT_PLACEHOLDER_CHAR} from '../../constants';
import {filter} from 'rxjs/operators';
import {isNil, isNotNil, isNotNilOrBlank} from '../../functions';
import {getCaretPosition, moveInputCaretToSeparator, selectInputContent, selectInputRange} from '../../inputs';
import {merge, Subscription} from 'rxjs';
import {TextMaskConfig} from 'angular2-text-mask';
import {DEFAULT_MAX_DECIMALS} from '../duration/duration.utils';

const MASKS: {
  [key: string]: {
    [pattern: string]: Array<string|RegExp>;
  };
} = {
  latitude: {
    DDMMSS: [' ', /\d/, /\d/, '°', ' ', /\d/, /\d/, '\'', ' ', /\d/, /\d/, '.', /\d/, /\d/, '"'],
    DDMM: [' ', /\d/, /\d/, '°', ' ', /\d/, /\d/, '.', /\d/, /\d/, /\d/, '\''],
    DD: [/[+-]/, ' ', /\d/, /\d/, '.', /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, '°']
  },
  longitude: {
    DDMMSS: [/\d/, /\d/, /\d/, '°', ' ', /\d/, /\d/, '\'', ' ', /\d/, /\d/, '.', /\d/, /\d/, '"'],
    DDMM: [/\d/, /\d/, /\d/, '°', ' ', /\d/, /\d/, '.', /\d/, /\d/, /\d/, '\''],
    DD: [/[+-]/, /\d/, /\d/, /\d/, '.', /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, '°']
  }
};

const noop = () => {
};

@Component({
  selector: 'mat-latlong-field',
  templateUrl: './material.latlong.html',
  styleUrls: ['./material.latlong.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => MatLatLongField),
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatLatLongField implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor {
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _subscription = new Subscription();
  protected disabling = false;
  protected writing = false;

  formatFn: LatLongFormatFn;
  formatFnOptions: LatLongFormatOptions;
  textMaskConfig: TextMaskConfig;
  textFormControl: FormControl;
  signFormControl: FormControl;
  mask: Array<string | RegExp> | ((raw: string) => Array<string | RegExp>) | false;
  value: number;
  inputPlaceholder: string;
  showSignControl: boolean;

  @Input() mobile: boolean;

  get disabled(): any {
    return this.readonly || this.formControl.disabled;
  }

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() type: 'latitude' | 'longitude';

  @Input('latLongPattern') pattern: LatLongPattern;

  @Input() defaultSign: '-' | '+';

  @Input() maxDecimals: number = LAT_LONG_DEFAULT_MAX_DECIMALS;

  @Input() placeholderChar: string = DEFAULT_PLACEHOLDER_CHAR;

  @Input() floatLabel: FloatLabelType = 'auto';

  @Input() readonly = false;

  @Input() required = false;

  @Input() tabindex: number;

  @Output()
  onBlur = new EventEmitter<FocusEvent>();

  @Output()
  onFocus = new EventEmitter<FocusEvent>();

  @ViewChild('inputElement') inputElement: ElementRef;

  @ViewChild('suffix', {static: false}) suffixDiv: ElementRef;

  @ViewChildren('injectMatSuffix') suffixInjections: QueryList<ElementRef>;

  constructor(
    private platform: Platform,
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
    this.mobile = this.platform.is('mobile');
  }

  ngOnInit() {
    this.type = this.type || 'latitude';
    this.pattern = this.pattern || 'DDMM';
    this.mask = MASKS[this.type] && MASKS[this.type][this.pattern];
    if (!this.mask) {
      console.error('Invalid attribute value. Expected: type: \'latitude|longitude\' and latlongPattern: \'DD|DDMM|DDMMSS\'');
      this.type = 'latitude';
      this.pattern = 'DDMM';
      this.mask = MASKS[this.type][this.pattern];
    }
    if (this.maxDecimals) {
      if (this.maxDecimals < 0) {
        console.error('Invalid attribute \'maxDecimals\'. Must a positive value.');
        this.maxDecimals = DEFAULT_MAX_DECIMALS;
      }
      // Remove max decimals in the DDMMSS format
      else if (this.pattern === 'DD') {
        console.warn(`Invalid attribute 'maxDecimals' - Must be '0' when using the 'DDMMSS' pattern.`);
        this.maxDecimals = 7;
      }
      else if (this.pattern === 'DDMMSS') {
        console.warn(`Invalid attribute 'maxDecimals' - Must be '0' when using the 'DDMMSS' pattern.`);
        this.maxDecimals = 0;
      }
      else if (this.maxDecimals !== DEFAULT_MAX_DECIMALS) {
        console.warn(`Invalid attribute 'maxDecimals' - Expected value: ${DEFAULT_MAX_DECIMALS}. Other value not implemented.`);
        this.maxDecimals = DEFAULT_MAX_DECIMALS;
      }
    }

    this.showSignControl = this.pattern !== 'DD';

    this.formatFn = this.type === 'latitude' ? formatLatitude : formatLongitude;
    this.formatFnOptions = {pattern: this.pattern, maxDecimals: this.maxDecimals, hideSign: this.showSignControl};

    this.inputPlaceholder = 'COMMON.LAT_LONG.' + (this.type === 'longitude' && 'D' || '') + this.pattern + '_PLACEHOLDER';

    this.textFormControl = this.formBuilder.control(
      this.required ? [null, Validators.required] : [null]
    );
    this.textMaskConfig = {mask: this.mask, keepCharPositions: true, placeholderChar: this.placeholderChar};

    this.signFormControl = this.formBuilder.control(
      this.required ? [null, Validators.required] : [null]
    );

    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-latlong-field>.');

    const existingValidators = this.formControl.validator;
    if (existingValidators) {
      this.formControl.setValidators([
        existingValidators,
        this.type === 'latitude' ? SharedValidators.latitude : SharedValidators.longitude
      ]);
    }
    else {
      this.formControl.setValidators(this.type === 'latitude' ? SharedValidators.latitude : SharedValidators.longitude);
    }

    this._subscription.add(
      merge(
        this.textFormControl.valueChanges,
        this.signFormControl.valueChanges
      )
        .subscribe((_) => this.onFormChange(this.textFormControl.value))
    );

    // Listen status changes (when done outside the component  - e.g. when setErrors() is calling on the formControl)
    this._subscription.add(
      this.formControl.statusChanges
        .pipe(
          filter((_) => !this.readonly && !this.writing && !this.disabling) // Skip
        )
        .subscribe((_) => this.markForCheck())
    );
  }

  ngAfterViewInit() {
    // Inject suffix elements, into the first injection point found
    if (this.suffixDiv) {
      this.suffixInjections.find(item => {
        item.nativeElement.append(this.suffixDiv.nativeElement);
        this.suffixDiv.nativeElement.classList.remove('cdk-visually-hidden');
        return true; // take only the first injection point
      });
    }
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  writeValue(obj: any): void {
    if (this.writing) return;

    this.value = (typeof obj === 'string') ? parseFloat(obj.replace(/,/g, '.')) : obj;
    this.writing = true;
    const strValue = this.formatFn(
      this.value,
      {
        ...this.formatFnOptions,
        placeholderChar: this.placeholderChar
      });
    const sign = isNotNil(this.value) ? (this.value < 0 ? -1 : 1) :
      // Use default sign, if any
      (this.defaultSign ? (this.defaultSign === '-' ? -1 : 1) : null);

    // DEBUG
    // console.debug("strValue: " + strValue)
    // console.debug("sign: " + sign)

    this.textFormControl.patchValue(strValue, {emitEvent: false});
    this.signFormControl.patchValue(sign, {emitEvent: false});
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
    if (isDisabled) {
      this.textFormControl.disable({onlySelf: true, emitEvent: false});
      this.signFormControl.disable({onlySelf: true, emitEvent: false});
    } else {
      this.textFormControl.enable({onlySelf: true, emitEvent: false});
      this.signFormControl.enable({onlySelf: true, emitEvent: false});
    }
    this.disabling = false;
    this.markForCheck();
  }

  private onFormChange(strValue): void {
    if (this.writing) return; // Skip if call by self
    this.writing = true;

    if (this.textFormControl.invalid || this.signFormControl.invalid) {
      this.formControl.markAsPending();
      this.formControl.setErrors({
        ...this.formControl.errors,
        ...this.textFormControl.errors,
        ...this.signFormControl.errors
      });
      this.writing = false;
      return;
    }

    const parsedValue = isNotNilOrBlank(strValue) ? parseLatitudeOrLongitude(strValue, this.pattern, 7 /*=precision of the converted double value */, this.placeholderChar) : null;

    // DEBUG
    //console.debug('parsedValue=', parsedValue);

    if (isNaN(parsedValue)) {
      this.formControl.markAsPending();
      this.formControl.setErrors(this.type === 'latitude' ? {latitude: true} : {longitude: true});
      this.writing = false;
      return;
    }
    const sign = (this.pattern === 'DD') ? 1 /*ignore sign*/ : (this.signFormControl.value || 1);
    this.value = isNotNil(parsedValue) ? sign * parsedValue : null;

    // Get the model value
    //console.debug("[mat-latlon] Setting value {" + this.value + "} parsed from {" + strValue + "}");
    this.formControl.patchValue(this.value, {emitEvent: false});
    this.writing = false;
    this.markForCheck();

    this._onChangeCallback(this.value);
  }

  checkIfTouched(): boolean {
    if (this.formControl.touched || this.textFormControl.touched) {
      this.markForCheck();
      this._onTouchedCallback();
      return true;
    }
    return false;
  }

  _onFocus(event: FocusEvent) {

    // Apply the default sign, when pattern is DD and field is empty
    if (isNil(this.value)) {
      if (this.defaultSign) {
        // Compute the text value, using the default sign
        const defaultSign = this.defaultSign === '-' ? -1 : 1;

        if (this.pattern === 'DD') {
          let valueStr = this.formatFn(defaultSign, {...this.formatFnOptions, placeholderChar: this.placeholderChar});
          valueStr = valueStr && valueStr.replace('1', this.placeholderChar);

          // Wait end of focus animation (label should move to top)
          setTimeout(() => {
            // Set the value
            this.inputElement.nativeElement.value = valueStr;

            // Move cursor after the sign
            const caretIndex = (this.type === 'latitude') ? 2 : 1;
            selectInputRange(event.target, caretIndex);
          }, 250);
        }
        else {
          this.signFormControl.setValue(defaultSign);
        }
      }
    }

    // Select the content (if there is a value)
    else {
      selectInputContent(event);
    }

    this.onFocus.emit(event);
    return true;
  }

  _onBlur(event: FocusEvent) {
    const touched = this.checkIfTouched();
    if (touched && isNil(this.value)) {
      this.inputElement.nativeElement.value = '';
    }
    this.onBlur.emit(event);
  }

  moveCaretToSeparator(event: any, forward: boolean): boolean {
    // Move to the space separator
    return moveInputCaretToSeparator(event, ' ', forward);
  }

  onKeypress(event: KeyboardEvent) {
    // Number entered or one of the 4 direction up, down, left and right
    if ((event.which >= 48 && event.which <= 57) || (event.which >= 37 && event.which <= 40)) {
      //console.debug('input number entered :' + event.which + ' ' + event.keyCode + ' ' + event.charCode);
      // OK
    }
    // Decimal separator entered
    else if (event.key === '.' || event.key === ',') {
      // DEBUG
      // console.debug('input decimal separator entered :' + event.code);

      // Move caret after point
      moveInputCaretToSeparator(event, '.');

      // OK
    } else {
      // Command entered (delete, backspace or one of the 4 direction up, down, left and right)
      if ((event.keyCode >= 37 && event.keyCode <= 40) || event.keyCode == 46 || event.which == 8 || event.keyCode == 9) {
        // DEBUG
        //console.debug('input command entered:' + event.which + ' ' + event.keyCode + ' ' + event.charCode);

        // OK
      }
      // Sign entered ('+' or '-')
      else if (event.keyCode === 43 || event.keyCode === 45) {
        // DEBUG
        // console.debug('input sign entered:' + event.which + ' ' + event.keyCode + ' ' + event.charCode);
        const caretPosition = getCaretPosition(event.target);
        if (this.pattern === 'DD' && caretPosition > 0) {
          const sign = event.key;
          // Wait key apply
          const value = this.inputElement.nativeElement.value;
          if (value && !value.startsWith(sign)) {
            const newValue = sign + (value.length > 1 ? value.substr(1) : '');

            // DEBUG
            // console.debug("sign entered. Updating input value to:", newValue);

            this.inputElement.nativeElement.value = newValue;
            selectInputRange(this.inputElement.nativeElement, caretPosition);
          }
          event.preventDefault();
        }

        // OK
      }
      // Direction char (capitalized)
      else if (event.key === 'N' || event.key === 'S' || event.key === 'E' || event.key === 'W') {
        // DEBUG
        // console.debug('input direction entered:' + event.which + ' ' + event.keyCode + ' ' + event.charCode);

        // OK
      }
      // Direction char
      else if (event.key === 'n' || event.key === 's' || event.key === 'e' || event.key === 'w') {
        // DEBUG
        // console.debug('input direction entered:' + event.which + ' ' + event.keyCode + ' ' + event.charCode);

        // Capitalize (with a delay, to be sure the key has been applied to input text)
        setTimeout(() => {
          this.inputElement.nativeElement.value = this.inputElement.nativeElement.value.toUpperCase();
        }, 10);

        // OK
      }

      // Any other keyboard events
      else {
        // DEBUG
        //console.debug('input not number entered :' + event.which + ' ' + event.keyCode + ' ' + event.charCode + ' ' + event.code );

        // KO: cancel the event
        event.preventDefault();
      }
    }
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }
}

