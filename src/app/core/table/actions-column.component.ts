import {ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatColumnDef, MatTable} from '@angular/material/table';
import {TableElement} from '@e-is/ngx-material-table';

@Component({
  selector: 'app-actions-column',
  templateUrl: './actions-column.component.html',
})
export class ActionsColumnComponent implements OnInit, OnDestroy {

  @ViewChild(MatColumnDef) columnDef: MatColumnDef;

  @Input() stickyEnd = true;
  @Input() optionsTitle = 'COMMON.BTN_OPTIONS';
  @Input('class') classList: string;

  @Output() optionsClick = new EventEmitter<Event>();
  @Output() cancelOrDeleteClick = new EventEmitter<{ event: Event; row: TableElement<any> }>();
  @Output() confirmAndAddClick = new EventEmitter<{ event: Event; row: TableElement<any> }>();

  constructor(private table: MatTable<any>,
              private cd: ChangeDetectorRef) {
    if (!table) throw new Error(`[actions-column] this column component must be inside a MatTable component`);
  }

  ngOnInit(): void {
    this.cd.detectChanges();
    this.table.addColumnDef(this.columnDef);
  }

  ngOnDestroy() {
    this.table.removeColumnDef(this.columnDef);
    this.optionsClick.complete();
    this.optionsClick.unsubscribe();
    this.cancelOrDeleteClick.complete();
    this.cancelOrDeleteClick.unsubscribe();
  }
}
