import { Component, OnInit, Inject } from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
  templateUrl: './hotkeys-dialog.component.html',
  styleUrls: ['./hotkeys-dialog.component.scss']
})
export class HotkeysDialogComponent implements OnInit {
  hotkeys = Array.from(this.data);

  constructor(@Inject(MAT_DIALOG_DATA) protected data) { }

  ngOnInit() {
  }

}
