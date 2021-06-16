import {AlertController} from '@ionic/angular';
import {TranslateService} from '@ngx-translate/core';

export class Alerts {

  /**
   * Ask the user to save before leaving. If return undefined: user has cancelled
   *
   * @param alertCtrl
   * @param translate
   * @param event
   * @deprecated prefer ComponentDirtyGuard
   */
  static async askSaveBeforeLeave(
    alertCtrl: AlertController,
    translate: TranslateService,
    event?: UIEvent): Promise<boolean|undefined> {
    let confirm = false;
    let cancel = false;
    const translations = translate.instant(['COMMON.BTN_SAVE', 'COMMON.BTN_CANCEL', 'COMMON.BTN_ABORT_CHANGES', 'CONFIRM.SAVE', 'CONFIRM.ALERT_HEADER']);
    const alert = await alertCtrl.create({
      header: translations['CONFIRM.ALERT_HEADER'],
      message: translations['CONFIRM.SAVE'],
      buttons: [
        {
          text: translations['COMMON.BTN_CANCEL'],
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            cancel = true;
          }
        },
        {
          text: translations['COMMON.BTN_ABORT_CHANGES'],
          cssClass: 'secondary',
          handler: () => {
          }
        },
        {
          text: translations['COMMON.BTN_SAVE'],
          handler: () => {
            confirm = true; // update upper value
          }
        }
      ]
    });
    await alert.present();
    await alert.onDidDismiss();

    if (confirm) return true; // = Do save and leave

    if (cancel) {
      // Stop the event
      if (event) event.preventDefault();

      return undefined; // User cancelled
    }

    return false; // Leave without saving
  }

  /**
   * Ask the user to conform an action. If return undefined: user has cancelled
   *
   * @param alertCtrl
   * @param translate
   * @param immediate is action has an immediate effect ?
   * @param event
   */
  static async askActionConfirmation(
    alertCtrl: AlertController,
    translate: TranslateService,
    immediate?: boolean,
    event?: UIEvent): Promise<boolean|undefined> {
    const messageKey = immediate === true ? 'CONFIRM.ACTION_IMMEDIATE' : 'CONFIRM.ACTION';
    return Alerts.askConfirmation(messageKey, alertCtrl, translate, event);
  }



  /**
   * Ask the user to confirm. If return undefined: user has cancelled
   *
   * @pram messageKey i18n message key
   * @param alertCtrl
   * @param translate
   * @param event
   */
  static async askConfirmation(
    messageKey: string,
    alertCtrl: AlertController,
    translate: TranslateService,
    event?: UIEvent): Promise<boolean|undefined> {
    if (!alertCtrl || !translate) throw new Error('Missing required argument \'alertCtrl\' or \'translate\'');
    let confirm = false;
    let cancel = false;
    const translations = translate.instant(['COMMON.BTN_YES_CONTINUE', 'COMMON.BTN_CANCEL', messageKey, 'CONFIRM.ALERT_HEADER']);
    const alert = await alertCtrl.create({
      header: translations['CONFIRM.ALERT_HEADER'],
      message: translations[messageKey],
      buttons: [
        {
          text: translations['COMMON.BTN_CANCEL'],
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            cancel = true;
          }
        },
        {
          text: translations['COMMON.BTN_YES_CONTINUE'],
          handler: () => {
            confirm = true; // update upper value
          }
        }
      ]
    });
    await alert.present();
    await alert.onDidDismiss();

    if (confirm) return true; // = Do save and leave

    if (cancel) {
      // Stop the event
      if (event) event.preventDefault();

      return undefined; // User cancelled
    }

    return false; // Leave without saving
  }


  /**
   * Ask the user to save before leaving. If return undefined: user has cancelled
   *
   * @param alertCtrl
   * @param translate
   * @param event
   */
  static async askDeleteConfirmation(
    alertCtrl: AlertController,
    translate: TranslateService,
    event?: UIEvent): Promise<boolean|undefined> {
    let confirm = false;
    let cancel = false;
    const translations = translate.instant(['COMMON.BTN_YES_DELETE', 'COMMON.BTN_CANCEL', 'CONFIRM.DELETE', 'CONFIRM.ALERT_HEADER']);
    const alert = await alertCtrl.create({
      header: translations['CONFIRM.ALERT_HEADER'],
      message: translations['CONFIRM.DELETE'],
      buttons: [
        {
          text: translations['COMMON.BTN_CANCEL'],
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            cancel = true;
          }
        },
        {
          text: translations['COMMON.BTN_YES_DELETE'],
          handler: () => {
            confirm = true; // update upper value
          }
        }
      ]
    });
    await alert.present();
    await alert.onDidDismiss();

    if (confirm) return true; // = Do save and leave

    if (cancel) {
      // Stop the event
      if (event) event.preventDefault();

      return undefined; // User cancelled
    }

    return false; // Leave without saving
  }


  static async askSaveBeforeAction(alertCtrl: AlertController,
                                    translate: TranslateService,
                                    event?: { valid: boolean }): Promise<{ confirmed: boolean; save: boolean } | undefined> {

    let save = false;
    let confirm = false;
    let alert: HTMLIonAlertElement;

    // Ask user before save
    if (event.valid) {
      const translations = translate.instant(['COMMON.BTN_CANCEL', 'COMMON.BTN_SAVE', 'COMMON.BTN_ABORT_CHANGES',
        'CONFIRM.SAVE_BEFORE_CLOSE', 'CONFIRM.ALERT_HEADER']);
      alert = await alertCtrl.create({
        header: translations['CONFIRM.ALERT_HEADER'],
        message: translations['CONFIRM.SAVE_BEFORE_CLOSE'],
        buttons: [
          {
            text: translations['COMMON.BTN_CANCEL'],
            role: 'cancel',
            cssClass: 'secondary',
            handler: () => {
            }
          },
          {
            text: translations['COMMON.BTN_ABORT_CHANGES'],
            cssClass: 'secondary',
            handler: () => {
              confirm = true;
            }
          },
          {
            text: translations['COMMON.BTN_SAVE'],
            handler: () => {
              save = true;
              confirm = true;
            }
          }
        ]
      });
    } else {
      const translations = translate.instant(['COMMON.BTN_ABORT_CHANGES', 'COMMON.BTN_CANCEL', 'CONFIRM.CANCEL_CHANGES', 'CONFIRM.ALERT_HEADER']);

      alert = await alertCtrl.create({
        header: translations['CONFIRM.ALERT_HEADER'],
        message: translations['CONFIRM.CANCEL_CHANGES'],
        buttons: [
          {
            text: translations['COMMON.BTN_ABORT_CHANGES'],
            cssClass: 'secondary',
            handler: () => {
              confirm = true;
            }
          },
          {
            text: translations['COMMON.BTN_CANCEL'],
            role: 'cancel',
            handler: () => {
            }
          }
        ]
      });
    }

    await alert.present();
    await alert.onDidDismiss();

    return {confirmed: confirm, save};
  }

  static async showError(
    messageKey: string,
    alertCtrl: AlertController,
    translate: TranslateService, opts?: {
      titleKey?: string;
    }) {
    if (!messageKey || !alertCtrl || !translate) throw new Error('Missing a required argument (\'messageKey\', \'alertCtrl\' or \'translate\')');
    const titleKey = opts && opts.titleKey || 'ERROR.ALERT_HEADER';
    const translations = translate.instant(['COMMON.BTN_OK', messageKey, titleKey]);
    const alert = await alertCtrl.create({
      header: translations[titleKey],
      message: translations[messageKey],
      buttons: [
        {
          text: translations['COMMON.BTN_OK'],
          role: 'cancel'
        }
      ]
    });
    await alert.present();
    await alert.onDidDismiss();

  }


}




