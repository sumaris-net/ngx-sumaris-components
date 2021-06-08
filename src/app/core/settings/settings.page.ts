import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {AccountService} from '../services/account.service';
import {EntityUtils} from '../services/model/entity.model';
import {APP_LOCALES, LocaleConfig, LocalSettings, UsageMode} from '../services/model/settings.model';
import {Peer} from '../services/model/peer.model';
import {referentialToString} from '../services/model/referential.model';
import {FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {AppForm} from '../form/form.class';
import {Moment} from 'moment';
import {DateAdapter} from '@angular/material/core';
import {AppFormUtils, FormArrayHelper} from '../form/form.utils';
import {TranslateService} from '@ngx-translate/core';
import {ValidatorService} from '@e-is/ngx-material-table';
import {LocalSettingsValidatorService} from '../services/validator/local-settings.validator';
import {PlatformService} from '../services/platform.service';
import {NetworkService} from '../services/network.service';
import {isNil, isNilOrBlank, toBoolean} from '../../shared/functions';
import {LocalSettingsService} from '../services/local-settings.service';
import {FormFieldDefinition, FormFieldDefinitionMap} from '../../shared/form/field.model';
import {merge} from 'rxjs';
import {AlertController} from '@ionic/angular';
import {Alerts} from '../../shared/alerts';
import {Property} from '../../shared/types';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'page-settings',
  templateUrl: 'settings.page.html',
  providers: [
    {provide: ValidatorService, useExisting: LocalSettingsValidatorService},
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage extends AppForm<LocalSettings> implements OnInit, OnDestroy {

  private data: LocalSettings;

  mobile: boolean;
  loading = true;
  saving = false;
  usageModes: UsageMode[] = ['FIELD', 'DESK'];

  propertyDefinitions: FormFieldDefinition[];
  propertyDefinitionsByKey: FormFieldDefinitionMap = {};
  propertyDefinitionsByIndex: { [index: number]: FormFieldDefinition } = {};
  propertiesFormHelper: FormArrayHelper<Property>;

  latLongFormats = ['DDMMSS', 'DDMM', 'DD'];

  get accountInheritance(): boolean {
    return this.form.controls['accountInheritance'].value;
  }

  get isLogin(): boolean {
    return this.accountService.isLogin();
  }

  get propertiesForm(): FormArray {
    return this.form.get('properties') as FormArray;
  }

  constructor(
    protected dateAdapter: DateAdapter<Moment>,
    protected platform: PlatformService,
    protected router: Router,
    protected validatorService: LocalSettingsValidatorService,
    protected alertCtrl: AlertController,
    protected translate: TranslateService,
    protected formBuilder: FormBuilder,
    protected accountService: AccountService,
    protected settings: LocalSettingsService,
    protected cd: ChangeDetectorRef,
    public network: NetworkService,
    @Inject(APP_LOCALES) public locales: LocaleConfig[]
  ) {
    super(dateAdapter, validatorService.getFormGroup(), settings);

    this.propertiesFormHelper = new FormArrayHelper<Property>(
      this.form.get('properties') as FormArray,
      (value) => this.validatorService.getPropertyFormGroup(value),
      (v1, v2) => (!v1 && !v2) || (v1.key === v2.key),
      (value) =>  isNil(value) || (isNil(value.key) && isNil(value.value)),
      {
        allowEmptyArray: true
      }
    );

    this.mobile = this.platform.mobile;

    // By default, disable the form
    this._enable = false;
  }

  async ngOnInit() {
    super.ngOnInit();

    // Make sure platform is ready
    await this.platform.ready();

    this.propertyDefinitions = this.settings.optionDefs.slice(); // copy options
    this.propertyDefinitions.forEach(o => this.propertyDefinitionsByKey[o.key] = o); // fill map

    // Load settings
    await this.load();

    this.registerSubscription(
      merge(
        this.accountService.onLogin,
        this.accountService.onLogout
      )
      .subscribe(() => this.setAccountInheritance(this.accountInheritance)));
  }

  getPropertyDefinition(index: number): FormFieldDefinition {
    let definition = this.propertyDefinitionsByIndex[index];
    if (!definition) {
      definition = this.updatePropertyDefinition(index);
      this.propertyDefinitionsByIndex[index] = definition;
    }
    return definition;
  }

  updatePropertyDefinition(index: number): FormFieldDefinition {
    const key = (this.propertiesForm.at(index) as FormGroup).controls.key.value;
    const definition = key && this.propertyDefinitionsByKey[key] || null;
    this.propertyDefinitionsByIndex[index] = definition; // update map by index
    this.markForCheck();
    return definition;
  }

  removePropertyAt(index: number) {
    this.propertiesFormHelper.removeAt(index);
    this.propertyDefinitionsByIndex = {}; // clear cache by index
    this.markForCheck();
  }

  async load() {

    this.loading = true;
    console.debug('[settings] Loading settings...');

    const data = this.settings.settings;

    // Set defaults
    data.accountInheritance = toBoolean(data.accountInheritance, true);
    data.locale = data.locale || this.translate.currentLang || this.translate.defaultLang;
    data.latLongFormat = data.latLongFormat || 'DDMMSS';
    data.usageMode = data.usageMode || 'DESK';

    // Set peer
    if (isNilOrBlank(data.peerUrl)) {
      await this.network.ready();
      const peer = this.network.peer;
      data.peerUrl = peer && peer.url;
    }

    // Remember data
    this.updateView(data);
  }

  updateView(data: LocalSettings) {
    if (!data) return; //skip
    this.data = data;

    const json: any = {...data};

    // Transform properties map into array
    json.properties = EntityUtils.getMapAsArray(data.properties || {});
    this.propertiesFormHelper.resize(json.properties.length);

    this.form.patchValue(json, {emitEvent: false});
    this.markAsPristine();

    this.enable({emitEvent: false});

    // Apply inheritance
    this.setAccountInheritance(data.accountInheritance, {emitEvent: false});

    this.loading = false;
    this.error = null;
    this.markForCheck();
  }

  async save(event?: UIEvent) {

    // Remove all empty controls
    this.propertiesFormHelper.removeAllEmpty();

    if (this.form.invalid && this.debug) {
      AppFormUtils.logFormErrors(this.form);
    }

    console.debug('[settings] Saving local settings...');

    this.saving = true;
    this.error = undefined;
    const data = await this.getValue();

    // Check peer alive, before saving
    const peerChanged = this.form.get('peerUrl').dirty;

    // Clean page history, when peer changed
    if (peerChanged) data.pageHistory = [];

    try {
      this.disable();

      await this.settings.apply(data);
      this.data = data;
      this.markAsPristine();

      // If peer changed
      if (peerChanged) {
        // Restart the network
        this.network.peer = Peer.parseUrl(data.peerUrl);
      }

    } catch (err) {
      console.error(err);
      this.error = err && err.message || err;
    } finally {
      this.enable({emitEvent: false});

      // Apply inheritance
      this.setAccountInheritance(data.accountInheritance, {emitEvent: false});

      this.saving = false;
      this.markForCheck();
    }
  }


  setAccountInheritance(enable: boolean, opts?: { emitEvent?: boolean }) {
    // Make sure to update the value in control
    this.form.controls['accountInheritance'].setValue(enable, opts);
    if (this.data.accountInheritance !== enable) {
      this.form.controls['accountInheritance'].markAsDirty({onlySelf: false});
    }

    if (enable) {
      if (this.isLogin) {
        // Force using account settings
        const account = this.accountService.account;

        // Copy values
        if (account.settings) {
          if (account.settings.locale) this.form.get('locale').setValue(account.settings.locale, opts);
          if (account.settings.latLongFormat) this.form.get('latLongFormat').setValue(account.settings.latLongFormat, opts);
        }
        // Disable fields
        this.form.get('locale').disable(opts);
        this.form.get('latLongFormat').disable(opts);
      } else {
        // Enable fields
        this.form.get('locale').enable(opts);
        this.form.get('latLongFormat').enable(opts);
      }
    } else {
      // Restore previous values
      this.form.get('locale').setValue(this.data.locale, opts);
      this.form.get('latLongFormat').setValue(this.data.latLongFormat, opts);

      // Enable fields
      this.form.get('locale').enable(opts);
      this.form.get('latLongFormat').enable(opts);
    }

    // Mark for check, if need
    if (!opts || opts.emitEvent) {
      this.markForCheck();
    }
  }

  async showSelectPeerModal(opts?: {
    allowSelectDownPeer?: boolean;
    canCancel?: boolean;
  }) {
    const peer = await this.network.showSelectPeerModal(opts);
    if (peer && peer.url) {
      const control = this.form.get('peerUrl') as FormControl;
      control.setValue(peer.url, {emitEvent: true, onlySelf: false});
      control.markAsDirty({onlySelf: false});
      this.markAsDirty();
    }
  }

  async cancel(event?: UIEvent) {
    await this.load();
  }

  async close(event?: UIEvent) {
    if (this.saving) return;

    if (this.dirty) {
      // Ask user confirmation
      const confirmation = await Alerts.askSaveBeforeLeave(this.alertCtrl, this.translate);
      if (confirmation) {
        await this.save(event);
      }
    }

    // Back to home
    return this.router.navigateByUrl('/', { skipLocationChange: true });
  }

  async clearCache(event?: UIEvent) {
    const confirm = await Alerts.askActionConfirmation(this.alertCtrl, this.translate, true, event);
    if (confirm) {
      await this.network.clearCache();
      this.settings.removeOfflineFeatures();
    }
  }

  referentialToString = referentialToString;

  /* -- protected functions -- */

  protected async getValue(): Promise<LocalSettings> {
    const json = await this.getJsonValueToSave();

    // Override properties from account
    if (json.accountInheritance && this.isLogin) {
      const account = this.accountService.account;
      const userSettings = account && account.settings;
      console.debug(`[settings] Applying account inheritance {locale: '${userSettings.locale}', latLongFormat: '${userSettings.latLongFormat}'}...`);
      json.locale = userSettings.locale || json.locale;
      json.latLongFormat = userSettings.latLongFormat || json.latLongFormat;
    }

    return json;
  }

  protected getJsonValueToSave(): Promise<any> {
    const json = this.form.value;
    json.properties = EntityUtils.getPropertyArrayAsObject(json.properties);

    return Promise.resolve(json);
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }


}
