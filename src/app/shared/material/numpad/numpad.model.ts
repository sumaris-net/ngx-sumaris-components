import {EventEmitter} from '@angular/core';

export interface MatNumpadRef {

    keypress: EventEmitter<KeyboardEvent>;

    close(): void;
}

export interface MatNumpadConfig {
  inputElement: any;
  keymap: MatNumpadKey[][];
  numpadRef: MatNumpadRef;
  decimal: boolean;
  disableAnimation: boolean;
  noBackdrop: boolean;
  position: string;

  appendToInput: boolean;
  // TODO
  //cssClass width = scope.settings.width || '100%';
  //scope.align = scope.settings.align || 'center';
  // animation: 'slide-up' | 'pop'
  // resizeContent: true
  // animationDuration = 150;
}

export interface MatNumpadKey {
  key: string;
  label?: string | number;
  color?: string;
  matIcon?: string;
  icon?: string;
}

export declare type MatNumpadKeymap = MatNumpadKey[][];

export const DEFAULT_KEYMAP: MatNumpadKeymap = [
  [{key: '1'}, {key: '2'}, {key: '3'}, {key: 'Backspace', icon: 'backspace', color: 'light'}],
  [{key: '4'}, {key: '5'}, {key: '6'}, {key: 'Tab', label: 'COMMON.BTN_NEXT_SHORT', color: 'light'}],
  [{key: '7'}, {key: '8'}, {key: '9'}, {key: '.', label: 'COMMON.BTN_DECIMAL_SEPARATOR', color: 'light'}],
  [null, {key: '0'}, null,  {key: 'Enter', icon: 'checkmark', color: 'tertiary'}]
];

//export declare type MatNumpadEventDetail = MatNumpadKey & {target: any};
//export declare type MatNumpadEvent = CustomEvent<MatNumpadEventDetail>

export class MatNumpadEvent extends KeyboardEvent {
  inputTarget: any;
  constructor(type: string, init: KeyboardEventInit & {target: any}) {
    super(type, init);
    this.inputTarget = init && init.target;
  }
}

