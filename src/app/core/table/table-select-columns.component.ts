import {Component, Input, OnInit} from '@angular/core';
import {ModalController, NavParams} from '@ionic/angular';
import {toBoolean} from '../../shared/functions';

export declare interface ColumnItem {
  name?: string;
  label: string;
  visible: boolean;
  canHide?: boolean;
}

@Component({
  selector: 'table-select-columns',
  templateUrl: './table-select-columns.component.html'
})
export class TableSelectColumnsComponent implements OnInit {

  @Input() columns: ColumnItem[];

  @Input() canHideColumns = true;

  constructor(
    private navParams: NavParams,
    private viewCtrl: ModalController) {
  }

  ngOnInit() {
    this.columns = this.columns || this.navParams.data && this.navParams.data.columns || [];

    this.columns.forEach(c => {
      // If cannot hide columns, make sure all columns are set to visible
      c.visible = (this.canHideColumns === false && true/*always visible*/) || c.visible;
      c.canHide = toBoolean(c.canHide, this.canHideColumns);
    });
  }

  onRenderItems(event: CustomEvent<{ from: number; to: number; complete: () => {} }>) {
    const element = this.columns.splice(event.detail.from, 1)[0];
    this.columns.splice(event.detail.to, 0, element);
    event.detail.complete();
  }

  close() {
    this.viewCtrl.dismiss(this.columns);
  }

  cancel() {
    this.viewCtrl.dismiss();
  }
}
