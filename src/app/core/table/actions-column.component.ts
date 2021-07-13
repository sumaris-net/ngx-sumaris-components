import {ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatColumnDef, MatTable} from '@angular/material/table';
import {TableElement} from '@e-is/ngx-material-table';
import {MatMenuTrigger} from '@angular/material/menu';
import {toBoolean} from '../../shared/functions';

@Component({
  selector: 'app-actions-column',
  templateUrl: './actions-column.component.html',
})
export class ActionsColumnComponent implements OnInit, OnDestroy {

  @ViewChild(MatColumnDef) columnDef: MatColumnDef;
  @ViewChild(MatMenuTrigger) matMenuTrigger: MatMenuTrigger;

  @Input() stickyEnd = false;
  @Input() canCancel: boolean;
  @Input() canDelete: boolean;
  @Input() canBackward: boolean;
  @Input() canForward: boolean;
  @Input() canConfirmAndAdd: boolean;
  @Input() optionsTitle = 'COMMON.BTN_OPTIONS';
  @Input('class') classList: string;

  @Output() optionsClick = new EventEmitter<UIEvent>();
  @Output() cancelOrDeleteClick = new EventEmitter<{ event: Event; row: TableElement<any> }>();
  @Output() confirmAndAddClick = new EventEmitter<{ event: Event; row: TableElement<any> }>();
  @Output() backward = new EventEmitter<{ event: Event; row: TableElement<any> }>();
  @Output() forward = new EventEmitter<{ event: Event; row: TableElement<any> }>();

  constructor(private table: MatTable<any>,
              private cd: ChangeDetectorRef) {
    if (!table) throw new Error(`[actions-column] this column component must be inside a MatTable component`);
  }

  ngOnInit(): void {
    this.cd.detectChanges();
    this.table.addColumnDef(this.columnDef);
    this.canCancel = toBoolean(this.canCancel, this.cancelOrDeleteClick.observers.length > 0);
    this.canDelete = toBoolean(this.canDelete, this.cancelOrDeleteClick.observers.length > 0);
    this.canConfirmAndAdd = toBoolean(this.canConfirmAndAdd, this.confirmAndAddClick.observers.length > 0);
    this.canBackward = toBoolean(this.canBackward, this.backward.observers.length > 0);
    this.canForward = toBoolean(this.canForward, this.forward.observers.length > 0);
  }

  ngOnDestroy() {
    this.table.removeColumnDef(this.columnDef);
    this.optionsClick.complete();
    this.optionsClick.unsubscribe();
    this.cancelOrDeleteClick.complete();
    this.cancelOrDeleteClick.unsubscribe();
    this.confirmAndAddClick.complete();
    this.confirmAndAddClick.unsubscribe();
    this.forward.complete();
    this.forward.unsubscribe();

  }

}
