import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {toBoolean} from '../functions';
import {Subscription} from 'rxjs';
import {Hotkeys} from '../hotkeys/hotkeys.service';
import {IconRef} from '../types';

@Component({
  selector: 'app-modal-toolbar',
  templateUrl: 'modal-toolbar.html',
  styleUrls: ['./modal-toolbar.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalToolbarComponent implements OnInit, OnDestroy {

  private _subscription = new Subscription();

  @Input()
  modalName = 'modal-toolbar';

  @Input()
  title = '';

  @Input()
  color = 'primary';

  @Input()
  showSpinner = false;

  @Input()
  canValidate: boolean;

  @Input() validateIcon: IconRef = {icon: 'checkmark'};

  @Output()
  cancel = new EventEmitter<UIEvent>();

  @Output()
  validate = new EventEmitter<UIEvent>();

  constructor(private hotkeys: Hotkeys) {}

  ngOnInit() {
    this.canValidate = toBoolean(this.canValidate, this.validate.observers.length > 0);

    // Escape
    this._subscription.add(
      this.hotkeys.addShortcut({keys: 'escape', description: 'COMMON.BTN_CLOSE', elementName: this.modalName})
        .subscribe((event) => this.cancel.emit(event)));

  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }

}
