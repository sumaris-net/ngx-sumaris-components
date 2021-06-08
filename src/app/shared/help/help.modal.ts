import {ChangeDetectorRef, Component, Injector, Input} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {PlatformService} from '../../core/services/platform.service';
import {LocalSettingsService} from '../../core/services/local-settings.service';
import {TranslateService} from '@ngx-translate/core';

@Component({
    selector: 'app-help-modal',
    templateUrl: './help.modal.html'
})
export class AppHelpModal {

  readonly debug: boolean;
  loading = true;
  error: string = undefined;

  @Input() title: string;
  @Input() markdownContent: string;
  @Input() docUrl: string;

  @Input()
  showError = true;

  constructor(
      protected injector: Injector,
      protected viewCtrl: ModalController,
      protected platform: PlatformService,
      protected settings: LocalSettingsService,
      protected translate: TranslateService,
      protected cd: ChangeDetectorRef
  ) {
    // TODO: for DEV only
    //this.debug = !environment.production;
  }

  async close(event?: UIEvent) {
      await this.viewCtrl.dismiss();
  }

  markAsLoaded() {
    this.loading = false;
    this.error = null;
  }

  onLoadError(error?: string) {
    console.error(error);

    this.error = error;
    this.loading = false;
  }


}
