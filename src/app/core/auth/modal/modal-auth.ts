import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {AccountService} from '../../services/account.service';
import {AuthForm} from '../form/form-auth';
import {firstNotNilPromise} from '../../../shared/observables';

@Component({
  templateUrl: 'modal-auth.html',
  styleUrls: ['./modal-auth.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthModal {

  loading = false;

  @ViewChild('form', { static: true }) private form: AuthForm;

  constructor(private accountService: AccountService,
              private viewCtrl: ModalController,
              private changeDetectorRef: ChangeDetectorRef
              ) {
  }

  cancel() {
    this.viewCtrl.dismiss();
  }

  async doSubmit(): Promise<any> {
    if (this.form.disabled) return;
    if (!this.form.valid) {
      this.form.markAsTouched();
      return;
    }
    this.loading = true;

    try {
      const data = this.form.value;

      // Disable the form
      this.form.disable();

      const account = await this.accountService.login(data);
      return this.viewCtrl.dismiss(account);
    }
    catch (err) {
      this.loading = false;
      this.form.error = err && err.message || err;
      this.markForCheck();

      // Enable the form
      this.form.enable();

      // Reset form error on next changes
      firstNotNilPromise(this.form.form.valueChanges).then(() => {
        this.form.error = null;
        this.markForCheck();
      });

      return;
    }
  }

  protected markForCheck() {
    this.changeDetectorRef.markForCheck();
  }
}
