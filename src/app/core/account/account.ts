import {Component, OnDestroy} from '@angular/core';
import {Subscription} from 'rxjs';
import {AccountFieldDef, AccountService} from '../services/account.service';
import {Account, referentialToString, StatusIds, UsageMode} from '../services/model';
import {UserSettingsValidatorService} from '../services/user-settings.validator';
import {FormBuilder, FormGroup} from '@angular/forms';
import {AccountValidatorService} from '../services/account.validator';
import {AppForm} from '../form/form.class';
import {Moment} from 'moment/moment';
import {DateAdapter} from "@angular/material";
import {Platform} from '@ionic/angular';
import {AppFormUtils} from '../form/form.utils';
import {TranslateService} from "@ngx-translate/core";

@Component({
  selector: 'page-account',
  templateUrl: 'account.html',
  styleUrls: ['./account.scss']
})
export class AccountPage extends AppForm<Account> implements OnDestroy {

  isLogin: boolean;
  changesSubscription: Subscription;
  account: Account;
  email: any = {
    confirmed: false,
    notConfirmed: false,
    sending: false,
    error: undefined
  };
  additionalFields: AccountFieldDef[];
  settingsForm: FormGroup;
  settingsContentForm: FormGroup;
  localeMap = {
    'fr': 'Français',
    'en': 'English'
  };
  locales: String[] = [];
  latLongFormats = ['DDMMSS', 'DDMM', 'DD'];
  saving = false;

  constructor(
    protected dateAdapter: DateAdapter<Moment>,
    public formBuilder: FormBuilder,
    public accountService: AccountService,
    protected validatorService: AccountValidatorService,
    protected settingsValidatorService: UserSettingsValidatorService,
    protected translate: TranslateService
  ) {
    super(dateAdapter, validatorService.getFormGroup(accountService.account));

    // Add settings fo form
    this.settingsForm = settingsValidatorService.getFormGroup(accountService.account && accountService.account.settings);
    this.settingsContentForm = (this.settingsForm.controls['content'] as FormGroup);
    this.form.addControl('settings', this.settingsForm);

    // Store additional fields
    this.additionalFields = accountService.additionalAccountFields;

    // Fill locales
    for (let locale in this.localeMap) {
      this.locales.push(locale);
    }

    // By default, disable the form
    this.disable();

    // Observed some events
    this.registerSubscription(this.accountService.onLogin.subscribe(account => this.onLogin(account)));
    this.registerSubscription(this.accountService.onLogout.subscribe(() => this.onLogout()));
    this.registerSubscription(this.onCancel.subscribe(() => {
      this.setValue(this.accountService.account);
      this.markAsPristine();
    }));
    if (accountService.isLogin()) {
      this.onLogin(this.accountService.account);
    }
  };

  ngOnDestroy() {
    super.ngOnDestroy();
    this.stopListenChanges();
  }

  onLogin(account: Account) {
    console.debug('[account] Logged account: ', account);
    this.isLogin = true;

    this.setValue(account);

    this.email.confirmed = account && account.email && (account.statusId != StatusIds.TEMPORARY);
    this.email.notConfirmed = account && account.email && (!account.statusId || account.statusId == StatusIds.TEMPORARY);

    this.enable();
    this.markAsPristine();

    this.startListenChanges();
  }

  onLogout() {
    this.isLogin = false;
    this.email.confirmed = false;
    this.email.notConfirmed = false;
    this.email.sending = false;
    this.email.error = undefined;
    this.form.reset();
    this.disable();

    this.stopListenChanges();
  }

  startListenChanges() {
    if (this.changesSubscription) return; // already started
    this.changesSubscription = this.accountService.listenChanges();
  }

  stopListenChanges() {
    if (!this.changesSubscription) return;
    this.changesSubscription.unsubscribe();
    this.changesSubscription = undefined;
  }

  async sendConfirmationEmail(event: MouseEvent) {
    const json = this.form.value;
    json.email = this.form.controls['email'].value;
    if (!json.email || !this.email.notConfirmed) {
      event.preventDefault();
      return false;
    }

    this.email.sending = true;
    console.debug("[account] Sending confirmation email...");
    try {
      await this.accountService.sendConfirmationEmail(
        json.email,
        json.settings && json.settings.locale || this.translate.currentLang
      );
      console.debug("[account] Confirmation email sent.");
      this.email.sending = false;
    }
    catch(err) {
      this.email.sending = false;
      this.email.error = err && err.message || err;
    }
  }

  async save(event: MouseEvent) {
    if (this.form.invalid) {
      AppFormUtils.logFormErrors(this.form);
      return;
    }

    this.saving = true;
    this.error = undefined;

    let json = Object.assign(this.accountService.account.asObject(), this.form.value);
    let newAccount = Account.fromObject(json);

    console.debug("[account] Saving account...", newAccount);
    try {
      this.disable();

      await this.accountService.saveRemotely(newAccount);

      this.markAsPristine();
    }
    catch (err) {
      console.error(err);
      this.error = err && err.message || err;
    }
    finally {
      this.saving = false;
      this.enable();
    }
  }

  enable() {
    super.enable();

    // Some fields are always disable
    this.form.controls.email.disable();
    this.form.controls.mainProfile.disable();
    this.form.controls.pubkey.disable();

    // Always disable some additional fields
    this.additionalFields
      .filter(field => !field.updatable.account)
      .forEach(field => {
        this.form.controls[field.name].disable();
      });
  }

  referentialToString = referentialToString;
}
