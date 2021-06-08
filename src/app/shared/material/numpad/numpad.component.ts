import {DEFAULT_KEYMAP, MatNumpadEvent, MatNumpadKeymap, MatNumpadRef} from './numpad.model';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NumpadDirective} from './numpad.directive';
import {MatNumpadContainerComponent} from './numpad.container';
import {MatNumpadDomService} from './numpad.dom-service';

@Component({
  selector: 'mat-numpad',
  template: '',
})
export class MatNumpadComponent implements MatNumpadRef {

  private _inputRef: NumpadDirective;
  private _opened = false;

  @Input() keymap: MatNumpadKeymap = DEFAULT_KEYMAP;

  @Input() decimal = true;

  @Input() appendToInput: boolean;
  @Input() disableAnimation = false;
  @Input() noBackdrop = false;
  @Input() position = 'bottom';

  @Output() keypress = new EventEmitter<KeyboardEvent>();
  @Output() closed = new EventEmitter<null>();

  get opened(): boolean {
    return this._opened;
  }

  get inputElement(): any {
    return this._inputRef && this._inputRef.element;
  }

  constructor(
    private domService: MatNumpadDomService
  ) {
  }

  registerInput(input: NumpadDirective) {
    if (this._inputRef) {
      throw new Error('A Numpad can only be registered to one input.');
    }
    this._inputRef = input;
  }

  open() {
    // Already open. Skip.
    if (this._opened) return;

    console.debug('[numpad] Opening numpad...');

    this.domService.appendNumpadToBody(MatNumpadContainerComponent, {
      numpadRef: this,
      decimal: this.decimal,
      keymap: this.keymap,
      inputElement: this.inputElement,
      appendToInput: this.appendToInput,
      disableAnimation: this.disableAnimation,
      noBackdrop: this.noBackdrop,
      position: this.position
    });

    this._opened = true;
  }

  close() {
    console.debug('[numpad] Closing numpad...');
    this.domService.destroyNumpad();
    this._opened = false;

    // Emit close event
    this.closed.next();
  }


}
