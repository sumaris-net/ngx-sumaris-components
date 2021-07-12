import {Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {Hotkeys} from '../../shared/hotkeys/hotkeys.service';
import {Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';

export abstract class FormButtonsBarToken {
  abstract onCancel: EventEmitter<Event>;
  abstract onSave: EventEmitter<Event>;
  abstract onNext: EventEmitter<Event>;
  abstract onBack: EventEmitter<Event>;
}

@Component({
  selector: 'app-form-buttons-bar',
  templateUrl: './form-buttons-bar.component.html',
  styleUrls: ['./form-buttons-bar.component.scss'],
  providers: [
    {provide: FormButtonsBarToken, useExisting: FormButtonsBarComponent}
  ],
})
export class FormButtonsBarComponent implements FormButtonsBarToken, OnDestroy {

    private _subscription = new Subscription();

    @Input() disabled = false;
    @Input() disabledCancel = false;
    @Input() classList: string;

    @Output()
    onCancel = new EventEmitter<Event>();

    @Output()
    onSave = new EventEmitter<Event>();

    @Output()
    onNext = new EventEmitter<Event>();

    @Output()
    onBack = new EventEmitter<Event>();

    constructor(private hotkeys: Hotkeys) {

        this._subscription.add(
            hotkeys.addShortcut({keys: 'control.s', description: 'COMMON.BTN_SAVE'})
                .pipe(filter(e => !this.disabled))
                .subscribe((event) => this.onSave.emit(event)));

        // Ctrl+Z
        this._subscription.add(
            hotkeys.addShortcut({keys: 'control.z', description: 'COMMON.BTN_RESET'})
                .pipe(filter(e => !this.disabled && !this.disabledCancel))
                .subscribe((event) => this.onCancel.emit(event))
        );

        // Escape
        this._subscription.add(
            hotkeys.addShortcut({keys: 'escape', description: 'COMMON.BTN_CLOSE', preventDefault: false})
                .subscribe((event) => this.onBack.emit(event)));
    }

    ngOnDestroy(): void {
      this._subscription.unsubscribe();
      this.onCancel.complete();
      this.onSave.complete();
      this.onNext.complete();
      this.onBack.complete();
    }

}
