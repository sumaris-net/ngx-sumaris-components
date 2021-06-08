import {Inject, Injectable} from '@angular/core';
import {EventManager} from '@angular/platform-browser';
import {Observable} from 'rxjs';
import {DOCUMENT} from '@angular/common';
import {MatDialog} from '@angular/material/dialog';
import {HotkeysDialogComponent} from './dialog/hotkeys-dialog.component';
import {isNotNilOrBlank} from '../functions';
import {ModalController} from '@ionic/angular';

interface Options {
  element: any;
  elementName: string;
  description: string | undefined;
  keys: string;
  preventDefault: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class Hotkeys {

  private _debug = false;
  private _hotkeys = new Map();

  private _defaults: Partial<Options> = {
    element: this.document,
    preventDefault: true
  };

  constructor(private eventManager: EventManager,
              private dialog: MatDialog,
              @Inject(DOCUMENT) private document: any,
              private modalController: ModalController) {
    if (this._debug) console.debug('[hotkeys] Starting hotkeys service... Press Shift+? to get help modal.');

    this.addShortcut({keys: 'shift.?'})
      .subscribe(() => this.openHelpModal());

    // For DEV only
    //this._debug = !environment.production;
  }

  addShortcut(options: Partial<Options>): Observable<UIEvent> {

    const merged = {...this._defaults, ...options};
    const event = `keydown.${merged.keys}`;

    if (isNotNilOrBlank(merged.description)) {
      if (this._debug) console.debug(`[hotkeys] Add shortcut {${options.keys}}: ${merged.description}`);
      this._hotkeys.set(merged.keys, merged.description);
    } else {
      if (this._debug) console.debug(`[hotkeys] Add shortcut {${options.keys}}`);
    }

    return new Observable(observer => {
      const handler = async (e: UIEvent) => {

        // Get top component from ModalController
        const top = await this.modalController.getTop();
        // If modal present, check its component name against hotkey element name (fix #181)
        if (top && top.component['name'] !== merged.elementName) return;

        if (e instanceof KeyboardEvent && e.repeat) return; // skip when repeated
        if (merged.preventDefault) e.preventDefault();
        if (this._debug) console.debug(`[hotkeys] Shortcut {${options.keys}} detected...`);
        observer.next(e);
      };

      const dispose = this.eventManager.addEventListener(merged.element, event, handler);

      return () => {
        dispose();
        this._hotkeys.delete(merged.keys);
      };
    });
  }

  openHelpModal() {
    this.dialog.open(HotkeysDialogComponent, {
      width: '500px',
      data: this._hotkeys
    });
  }

}
