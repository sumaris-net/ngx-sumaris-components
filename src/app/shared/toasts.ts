import {createAnimation, IonicSafeString, ToastController} from '@ionic/angular';
import {TranslateService} from '@ngx-translate/core';
import {OverlayEventDetail, ToastOptions} from '@ionic/core';
import {ToastButton} from '@ionic/core/dist/types/components/toast/toast-interface';
import {isEmptyArray, isNotNil} from './functions';

const TOAST_MAX_HEIGHT_PX = 75;
const TOAST_MAX_STACK_SIZE = 4;

export declare interface ShowToastOptions extends ToastOptions {
  type?: 'error'|'warning'|'info';
  messageParams?: any;
  showCloseButton?: boolean;
  onWillPresent?: (toast: HTMLIonToastElement) => void;
}

export class Toasts {
  static counter = 0;
  static stackSize = 0;

  static async show<T = any>(
    toastController: ToastController,
    translate: TranslateService,
    opts: ShowToastOptions
  ): Promise<OverlayEventDetail<T>> {
    if (!toastController || !translate) {
      console.error('Missing required argument \'toastController\' or \'translate\'');
      if (opts.message instanceof IonicSafeString) console.info('[toasts] message: ' + (translate && translate.instant(opts.message.value) || opts.message.value));
      else if (typeof opts.message === 'string') console.info('[toasts] message: ' + (translate && translate.instant(opts.message, opts.messageParams) || opts.message));
      return Promise.resolve({});
    }

    this.counter++; // Increment toast counter
    let currentOffset = this.stackSize;
    if (this.stackSize < TOAST_MAX_STACK_SIZE) {
      this.stackSize++; // Increment stack offset
    }
    else {
      this.stackSize = 1; // Reset the stack
      currentOffset = 0;
    }
    const updateCounters = () => {
      // Decrease counter
      this.counter--;
      // If all toast closed: reset the stack offset
      if (this.counter === 0) {
        this.stackSize = 0;
      }
      // If current toast is the last one, decrease the offset
      else if (this.stackSize == currentOffset + 1){
        this.stackSize--;
      }
    };


    const message = opts.message && opts.message instanceof IonicSafeString ? opts.message.value : opts.message as string;
    const i18nKeys = [message];
    if (opts.header) i18nKeys.push(opts.header);

    let closeButton: ToastButton;
    if (opts.showCloseButton) {
      opts.buttons = opts.buttons || [];
      const buttonIndex = opts.buttons
        .map(b => typeof b === 'object' && b as ToastButton || undefined)
        .filter(isNotNil)
        .findIndex(b => b.role === 'close');
      if (buttonIndex !== -1) {
        closeButton = opts.buttons[buttonIndex] as ToastButton;
      } else {
        closeButton = {role: 'close'};
        opts.buttons.push(closeButton);
      }
      closeButton.text = closeButton.text || 'COMMON.BTN_OK';
      i18nKeys.push(closeButton.text);
    }

    // Read CSS
    const cssArray = opts.cssClass && typeof opts.cssClass === 'string' && opts.cssClass.split(',') || (opts.cssClass as Array<string>) || [];

    // Add 'error' class, if need
    if (opts.type) {
      switch (opts.type) {
        case 'error':
          opts.header = 'ERROR';
          cssArray.push('danger');
          break;
        case 'warning':
          cssArray.push('accent');
          break;
        case 'info':
          cssArray.push('secondary');
          break;
      }
    }

    opts.cssClass = cssArray;

    const translations = translate.instant(i18nKeys);
    if (opts.messageParams) {
      translations[message] = translate.instant(message, opts.messageParams);
    }

    if (closeButton) {
      closeButton.text = translations[closeButton.text];
    }

    // Retrieve the toast position
    const position = opts.position || (opts.mode === 'ios' ? 'bottom' : 'top');

    if (!opts.enterAnimation && position !== 'middle') {
      // Compute positions, using the stack offset
      const direction = position === 'top' ? 1 : -1;
      const start = (currentOffset) * TOAST_MAX_HEIGHT_PX  - direction * TOAST_MAX_HEIGHT_PX;
      const end = direction * (currentOffset) * TOAST_MAX_HEIGHT_PX;
      opts.enterAnimation = (baseEl: any, opts?: any) => createAnimation()
          .addElement(baseEl.querySelector('.toast-wrapper'))
          .duration(250)
          .fromTo('transform', `translateY(${start}px)`, `translateY(${end}px)`)
          .fromTo('opacity', '0', '1');
    }

    const toast = await toastController.create({
      // Default values
      position,
      duration: opts.showCloseButton ? 10000 : 4000,
      ...opts,
      message: translations[message],
      header: opts.header && translations[opts.header] || undefined
    });

    if (opts.onWillPresent) opts.onWillPresent(toast);

    await toast.present();

    if (isEmptyArray(opts.buttons)) {
      // Not need to wait dismiss (no 'await')
      toast.onDidDismiss().then(updateCounters);
      return null; // no result
    }

    else {
      // Wait for button result
      const result = await toast.onDidDismiss();

      updateCounters();

      return result;
    }
  }
}
