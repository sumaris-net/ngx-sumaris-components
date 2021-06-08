import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {MatNumpadConfig, MatNumpadEvent, MatNumpadKey, MatNumpadKeymap, MatNumpadRef} from './numpad.model';
import {BehaviorSubject} from 'rxjs';
import {animate, AnimationEvent, state, style, transition, trigger} from '@angular/animations';

export enum AnimationState {
  ENTER = 'enter',
  ENTER_INPUT = 'enter-input',
  LEAVE = 'leave'
}
@Component({
  selector: 'mat-numpad-container',
  templateUrl: './numpad.container.html',
  styleUrls: ['./numpad.container.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    // Backdrop animation
    trigger('numpadBackdrop', [
      state('*', style({opacity: 0, background: 'transparent'})),
      state(AnimationState.ENTER, style({opacity: 1})),
      state(AnimationState.LEAVE, style({opacity: 0})),
      transition(`* => ${AnimationState.ENTER}`, [
        style({opacity: 0}),
        animate('0.4s cubic-bezier(0.25, 0.8, 0.25, 1)')
      ]),
      transition(`${AnimationState.ENTER} => ${AnimationState.LEAVE}`, [
        style({ opacity: 1}),
        animate('0.2s cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ]),

    // Fade in
    trigger('numpadFadeIn', [
      state('*', style({opacity: 1, transform: 'scale(1)'})),
      state(AnimationState.ENTER, style({opacity: 1, transform: 'scale(1)'})),
      state(AnimationState.LEAVE, style({opacity: 0, transform: 'scale(0.9)'})),
      // Modal
      transition(`* => ${AnimationState.ENTER}`, [
        style({opacity: 0, transform: 'scale(0.6)'}),
        animate('0.2s ease-out')
      ]),
      transition(`${AnimationState.ENTER} => ${AnimationState.LEAVE}`, [
        animate('0.2s ease-out')
      ]) ]),

    // Panel expansion
    trigger('numpadPanelExpansion', [
      state('*', style({opacity: 1, transform: 'scaleY(0) translateY(-50%)'})),
      state(AnimationState.ENTER, style({opacity: 1, transform: 'scale(1) translateY(0)'})),
      state(AnimationState.LEAVE, style({opacity: 0, transform: 'scale(1) translateY(0)'})),

      // Attach to input
      transition(`* => ${AnimationState.ENTER}`, [
        animate('0.2s ease-out')
      ]),
      transition(`${AnimationState.ENTER} => ${AnimationState.LEAVE}`, [
        animate('0.2s ease-out')
      ])
    ])
  ]
})
export class MatNumpadContainerComponent implements OnInit, OnDestroy, MatNumpadConfig {

  private debug = true;

  backdropState: AnimationState = AnimationState.LEAVE;
  modalState: AnimationState;
  panelState: AnimationState;
  numpadRef: MatNumpadRef;
  inputElement: any;
  columnCount = 4;

  filteredKeymap = new BehaviorSubject<MatNumpadKeymap>(undefined);

  // Config options
  decimal: boolean;
  disabled: boolean;
  appendToInput: boolean;
  keymap: MatNumpadKeymap;
  disableAnimation: boolean;
  noBackdrop: boolean;
  position: string;

  constructor(
    protected cd: ChangeDetectorRef
  ) {
    if (this.debug) console.debug('[numpad-container] Creating component');
  }

  ngOnInit(): void {
    if (!this.keymap || !this.keymap.length) {
      throw new Error('An invalid \'keymap\' was sent to numpad container');
    }


    if (!this.disableAnimation) {
      if (this.appendToInput) {
        this.panelState = AnimationState.ENTER;
      }
      else {
        this.modalState = AnimationState.ENTER;
      }
    }

    this.noBackdrop = this.noBackdrop || this.appendToInput;
    if (!this.noBackdrop) {
      this.backdropState = AnimationState.ENTER;
    }

    const keymap = this.defineFilteredKeymap();
    this.filteredKeymap.next(keymap);

    // Count columns
    this.columnCount = keymap.reduce((res, row) => row && Math.max(res, row.length), 0);
    if (this.debug) console.debug('[numpad-container] columnCount=' + this.columnCount);

    //this.markForCheck();
  }

  ngOnDestroy(): void {
  }

  onButtonClick(event: UIEvent, keyDef: MatNumpadKey) {
    if (this.debug) console.debug('[numpad-container] onKeyPress() ', keyDef.key);

    const customEvent = new MatNumpadEvent('keypress', {key: keyDef.key, target: this.inputElement});

      //{detail: {...keyDef, target: this.inputElement}})
    this.numpadRef.keypress.next(customEvent);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    //if (this.debug)
    console.debug('[numpad-container] onKeypress()', event);
    this.numpadRef.keypress.next(event);
  }

  overlayClick(event: UIEvent) {

    this.close();
  }

  close(): void {
    if (this.disableAnimation) {
      this.numpadRef.close();
      return;
    }

    if (this.modalState) this.modalState = AnimationState.LEAVE;
    if (this.panelState) this.panelState = AnimationState.LEAVE;
    if (this.backdropState) this.backdropState = AnimationState.LEAVE;
    this.markForCheck();
  }

  animationDone(event: AnimationEvent): void {
    if (event.phaseName === 'done' && event.toState === AnimationState.LEAVE) {
      this.numpadRef.close();
    }
  }

  protected defineFilteredKeymap(): MatNumpadKeymap {
    let keymap = this.keymap;

    // Replace decimal separator button, by empty
    if (!this.decimal) {
      keymap = keymap.map(row => row.map(item => item && item.key !== '.' && item.key !== ',' ? item : null));
    }

    return keymap;
  }
  protected markForCheck() {
    this.cd.markForCheck();
  }

}
