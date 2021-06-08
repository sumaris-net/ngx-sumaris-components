import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnInit,
  Optional,
  Output, Provider, QueryList,
  ViewChild, ViewChildren
} from '@angular/core';
import {FloatLabelType} from '@angular/material/form-field';
import {ControlValueAccessor, FormBuilder, FormControl, FormGroupDirective, NG_VALUE_ACCESSOR} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {isNil, isNotNil} from '../../functions';
import {InputElement} from '../../inputs';
import {MatRadioButton, MatRadioChange} from '@angular/material/radio';
import {MatCheckbox, MatCheckboxChange} from '@angular/material/checkbox';
import {MatDateShort} from '../datetime/material.dateshort';

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatBooleanField),
  multi: true
};


const noop = () => {
};

@Component({
  selector: 'mat-boolean-field',
  templateUrl: './material.boolean.html',
  styleUrls: ['./material.boolean.scss'],
  providers: [
    DEFAULT_VALUE_ACCESSOR
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatBooleanField implements OnInit, AfterViewInit, ControlValueAccessor, InputElement {
  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _writing = false;

  _value: boolean;
  _tabindex: number;

  showRadio = false;

  @Input() disabled = false;

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() placeholder: string;

  @Input() floatLabel: FloatLabelType = 'auto';

  @Input() readonly = false;

  @Input() required = false;

  @Input() compact = false;

  @Input() style: 'radio' | 'checkbox' | 'button';

  @Output('keyup.enter')
  onPressEnter = new EventEmitter<any>();

  @Output()
  onBlur = new EventEmitter<FocusEvent>();

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
    return this._value;
  }

  @Input()
  set value(v: any) {
    if (v !== this._value) {
      this._value = v;
      this._onChangeCallback(v);
    }
  }

  @ViewChild('yesButton') yesButton: MatRadioButton;
  @ViewChild('noButton') noButton: MatRadioButton;

  @ViewChild('checkboxButton') checkboxButton: MatCheckbox;

  @ViewChild('fakeInput') fakeInput: ElementRef;

  @ViewChild('suffix', {static: false}) suffixDiv: ElementRef;

  @ViewChildren('injectMatSuffix') suffixInjections: QueryList<ElementRef>;

  constructor(
    private translate: TranslateService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) { }

  ngOnInit() {
    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-boolean-field>.');

    this.style = this.style || (this.compact ? 'checkbox' : 'radio');

    // Force show radio if label always on top
    this.showRadio = this.showRadio || this.floatLabel === 'always';

    this.updateTabIndex();
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

  writeValue(value: any, event?: UIEvent): void {
    if (this._writing) return;

    this._writing = true;
    if (value !== this._value) {
      this._value = value;
      this.showRadio = this.floatLabel === 'always' || isNotNil(this._value);
      if (isNotNil(this.tabindex)) {
        setTimeout(() => this.updateTabIndex());
      }
    }
    this._writing = false;

    if (this.style === 'button' && event) {
      if (value !== this.formControl.value) {
        this.formControl.patchValue(value, {emitEvent: false});
      }
      if (event) this.onPressEnter.emit(event);
    }

    this.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }


  _onBlur(event: FocusEvent) {
    this.checkIfTouched();
    this.onBlur.emit(event);
  }

  _onFocusFakeInput(event: FocusEvent) {
    event.preventDefault();

    // Hide the fake input
    if (this.fakeInput) {
      this.fakeInput.nativeElement.classList.add('hidden');
      this.fakeInput.nativeElement.tabIndex = -1;
    }

    // Focus on first button
    this.focus();
  }

  focus() {
    this.showRadio = true;
    setTimeout(() => {
      if (this.yesButton) {
        this.yesButton.focus();
      }
      else if (this.checkboxButton) {
        this.checkboxButton.focus();
      }
      this.updateTabIndex();
    });
    this.markForCheck();
  }

  onRadioValueChanged(event: MatRadioChange): void {
    if (this._writing) return; // Skip if call by self
    this._writing = true;
    this._value = event.value;
    this.checkIfTouched();
    this._onChangeCallback(event.value);
    this._writing = false;
  }

  onCheckboxValueChanged(event: MatCheckboxChange): void {
    if (this._writing) return; // Skip if call by self
    this._writing = true;
    this._value = event.checked;
    this.checkIfTouched();
    this._onChangeCallback(event.checked);
    this._writing = false;
  }

  /* -- private method -- */

  private checkIfTouched() {
    if (this.formControl.touched) {
      this.markForCheck();
      this._onTouchedCallback();
    }
  }

  /**
   * This is a special case, because, this component has a temporary component displayed before the first focus event
   */
  private updateTabIndex() {
    if (isNil(this._tabindex) || this._tabindex === -1) return;

    if (this.fakeInput) {
      if (this.showRadio) {
        this.fakeInput.nativeElement.classList.add('hidden');
        this.fakeInput.nativeElement.tabIndex = -1;
      } else {
        this.fakeInput.nativeElement.classList.remove('hidden');
        this.fakeInput.nativeElement.tabIndex = this._tabindex;
      }
    }
    if (this.yesButton) {
      this.yesButton._inputElement.nativeElement.tabIndex = this.showRadio ? this._tabindex : -1;
      this.noButton._inputElement.nativeElement.tabIndex = this.showRadio ? this._tabindex + 1 : -1;
    } else if (this.checkboxButton) {
      this.checkboxButton._inputElement.nativeElement.tabIndex = this.showRadio ? this._tabindex : -1;
    }
    this.markForCheck();
  }


  private markForCheck() {
    this.cd.markForCheck();
  }
}

