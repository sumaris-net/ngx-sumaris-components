import {Directive, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {Subscription} from 'rxjs';
import {MatNumpadKeymap} from './numpad.model';
import {MatNumpadComponent} from './numpad.component';

@Directive({
  selector: '[matNumpad]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: NumpadDirective,
      multi: true
    }
  ],
  host: {
    '[disabled]': 'disabled',
    // '[decimal]': 'decimal',
    '(click)': 'onClick($event)',
    '(change)': 'updateValue($event.target.value)',
    '(blur)': 'onTouched()'
  },
})
export class NumpadDirective implements ControlValueAccessor, OnDestroy, OnChanges {

  private _numpad: MatNumpadComponent;

  @Input() keymap: MatNumpadKeymap;

  @Input('matNumpad')
  set numpad(numpad: MatNumpadComponent) {
    this.registerNumpad(numpad);
  }

  @Input()
  set value(value: string) {
    this._value = value || '';
    this.updateInputValue();
    return;
  }

  get value(): string {
    if (!this._value) {
      return '';
    }
    return this._value;
  }

  private _value = '';

  @Input() disabled: boolean;
  @Input() decimal: boolean;
  @Input() disableClick: boolean;

  private numpadSubscriptions: Subscription[] = [];

  onTouched = () => {
  };

  private onChange: (value: any) => void = () => {
  };

  constructor(private elementRef: ElementRef) {
  }

  get element(): any {
    return this.elementRef && this.elementRef.nativeElement;
  }

  updateValue(value: string) {
    console.debug('[numpad-directive] updateValue()', value);
    this.value = value;
    this.onChange(value);
  }

  ngOnChanges(changes: SimpleChanges){
    /*if (changes['value'] && changes['value'].currentValue) {
      this.defaultValue = changes['value'].currentValue;
    }*/
  }

  @HostListener('click', ['$event'])
  onClick(event: UIEvent) {
    if (!this.disableClick) {
      this._numpad.open();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  writeValue(value: string): void {
    this.value = value;
    if (value) {
      //this.defaultValue = value;
    }
  }


  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  ngOnDestroy() {
    this.numpadSubscriptions.forEach(s => s.unsubscribe());
  }

  private registerNumpad(numpad: MatNumpadComponent): void {
    if (numpad) {
      console.debug('[numpad-directive] Registering numpad', numpad);
      this._numpad = numpad;
      this._numpad.registerInput(this);
      this.numpadSubscriptions.push(this._numpad.keypress
        .pipe(
          //filter(event => event.inputTarget === this.element)
        )
        .subscribe(event => this.applyingKey(event))
        );

    } else {
      throw new Error('MatNumpadComponent is not defined.' +
        ' Please make sure you passed the numpad to matNumpad directive');
    }
  }

  private applyingKey(event: KeyboardEvent) {
    console.debug('[numpad-directive] Receiving key=' + event.key);
    let value = this.value !== null && this.value !== undefined ? this.value : '';
    // Remove french decimal separator
    value = (typeof value === 'number') ? ('' + value) : value.replace(',', '.');
    if (event.key === '.' || event.key === ',') {
      if (value.indexOf('.') === -1) {
        value += '.';
      }
    }

    else if (event.key === 'Backspace') {
      // Remove last character
      value = value.length > 1 ? value.substr(0, value.length - 1) : '';
    }
    else if (event.key === 'Enter' || event.keyCode === 13) {
      this._numpad.close();
      return;
    }
    else if (event.key === 'Tab') {
      // TODO goto next input ?
      return; // Skip
    }
    else if (event.key === 'Escape') {
      this._numpad.close();
      return;
    }
    else {
      value += (event.key || '');
    }

    this.updateValue(value);
    this.onTouched();
  }

  private updateInputValue(): void {
    this.elementRef.nativeElement.value = this.value;
  }

}

