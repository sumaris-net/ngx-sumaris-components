import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Inject, Input, OnInit, Optional, Output} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {ModalController} from '@ionic/angular';
import {RegisterModal} from '../../register/modal/modal-register';
import {AuthData} from '../../services/account.service';
import {AuthTokenType, NetworkService} from '../../services/network.service';
import {LocalSettingsService} from '../../services/local-settings.service';
import {slideUpDownAnimation} from '../../../shared/material/material.animations';
import {PlatformService} from '../../services/platform.service';
import {DateAdapter} from '@angular/material/core';
import {Moment} from 'moment';
import {debounceTime} from 'rxjs/operators';
import {AppForm} from '../../form/form.class';
import {ENVIRONMENT} from '../../../../environments/environment.class';
import {CORE_CONFIG_OPTIONS} from '../../services/config/core.config';
import {ConfigService} from '../../services/config.service';


@Component({
  selector: 'app-form-auth',
  templateUrl: 'form-auth.html',
  styleUrls: ['./form-auth.scss'],
  animations: [slideUpDownAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthForm extends AppForm<AuthData> implements OnInit {

  loading = false;
  readonly mobile: boolean;
  canWorkOffline = false;
  showPwd = false;
  canRegister: boolean;
  usernamePlaceholder: string;

  @Output() onCancel = new EventEmitter<any>();
  @Output() onSubmit = new EventEmitter<AuthData>();

  disable(opts?: { onlySelf?: boolean; emitEvent?: boolean }) {
    super.disable(opts);
    this.showPwd = false; // Hide pwd when disable (e.g. when submitted)
  }

  constructor(
    platform: PlatformService,
    dateAdapter: DateAdapter<Moment>,
    formBuilder: FormBuilder,
    settings: LocalSettingsService,
    private configService: ConfigService,
    private modalCtrl: ModalController,
    public network: NetworkService,
    private cd: ChangeDetectorRef,
    @Optional() @Inject(ENVIRONMENT) protected environment
  ) {
    super(dateAdapter,
      formBuilder.group({
      username: [null, Validators.required],
      password: [null, Validators.required],
      offline: [network.offline]
    }), settings);

    this.mobile = platform.mobile;
    this.canWorkOffline = this.settings.hasOfflineFeature();
    this._enable = true;

  }

  ngOnInit() {
    super.ngOnInit();

    // Load config, to set username's label and validator
    this.registerSubscription(
      this.configService.config.subscribe(config => {
        // Set the username placeholder, with email or username
        const tokenType = config.getProperty(CORE_CONFIG_OPTIONS.AUTH_TOKEN_TYPE) as AuthTokenType;
        if (tokenType === 'token') {
          this.usernamePlaceholder = 'USER.EMAIL';
          this.form.get('username').setValidators(Validators.compose([Validators.required, Validators.email]));
        }
        else {
          this.usernamePlaceholder = 'USER.USERNAME';
          this.form.get('username').setValidators(Validators.required);
        }

        // Enable/disable registration link
        this.canRegister = config.getProperty(CORE_CONFIG_OPTIONS.REGISTRATION_ENABLE);

        this.markForCheck();
      })
    );

    // For DEV only
    if (this.environment && this.environment.production === false) {
      // Set the default user, for testing.
      // (see values in the test database - XML files in the module 'sumaris-core-test-shared')
      this.form.patchValue({

        // Basic auth (using Person.username)
        // username: 'admq2', password: 'q22006'

        // Token auth (using Person.pubkey)
        username: 'admin@sumaris.net', password: 'admin'
      });
    }
  }

  cancel() {
    this.onCancel.emit();
  }

  doSubmit(event?: UIEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.form.invalid || this.loading) return;

    this.loading = true;
    const data = this.form.value;
    this.showPwd = false; // Hide password
    this.error = null; // Reset error

    this.registerSubscription(
      this.onSubmit
        .pipe(debounceTime(500))
        .subscribe(res => this.loading = false));

    setTimeout(() => this.onSubmit.emit({
      username: data.username,
      password: data.password,
      offline: data.offline
    }));
  }

  register() {
    this.onCancel.emit();
    setTimeout(async () => {
      const modal = await this.modalCtrl.create({
        component: RegisterModal,
        backdropDismiss: false
      });
      return modal.present();
    }, 200);
  }

  /* -- protected functions -- */

  protected markForCheck() {
    this.cd.markForCheck();
  }
}
