import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Injector, OnInit, ViewChild} from '@angular/core';
import {Person, PRIORITIZED_AUTHORITIES} from '../../../core/services/model/person.model';
import {DefaultStatusList, referentialToString} from '../../../core/services/model/referential.model';
import {PersonService} from '../../services/person.service';
import {PersonValidatorService} from '../../services/validator/person.validator';
import {ModalController} from '@ionic/angular';
import {ActivatedRoute, Router} from '@angular/router';
import {AccountService} from '../../../core/services/account.service';
import {Location} from '@angular/common';
import {AbstractControl, FormBuilder, FormGroup} from '@angular/forms';
import {AppTable, RESERVED_END_COLUMNS, RESERVED_START_COLUMNS, SETTINGS_FILTER} from '../../../core/table/table.class';
import {ValidatorService} from '@e-is/ngx-material-table';
import {FormFieldDefinition} from '../../../shared/form/field.model';
import {PlatformService} from '../../../core/services/platform.service';
import {LocalSettingsService} from '../../../core/services/local-settings.service';
import {debounceTime, filter, tap} from 'rxjs/operators';
import {EntitiesTableDataSource} from '../../../core/table/entities-table-datasource.class';
import {isNotNil} from '../../../shared/functions';
import {ENVIRONMENT} from '../../../../environments/environment.class';
import {PersonFilter} from '../../services/filter/person.filter';
import {ConfigService} from '../../../core/services/config.service';
import {CORE_CONFIG_OPTIONS} from '../../../core/services/config/core.config';
import {AuthTokenType} from '../../../core/services/network.service';
import {MatExpansionPanel} from '@angular/material/expansion';
import {slideUpDownAnimation} from '../../../shared/material/material.animations';

@Component({
  selector: 'app-users-table',
  templateUrl: 'users.html',
  styleUrls: ['./users.scss'],
  providers: [
    {provide: ValidatorService, useExisting: PersonValidatorService}
  ],
  animations: [slideUpDownAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPage extends AppTable<Person, PersonFilter> implements OnInit {

  canEdit = false;
  filterForm: FormGroup;
  profiles = [...PRIORITIZED_AUTHORITIES].reverse();
  additionalFields: FormFieldDefinition[];
  statusList = DefaultStatusList;
  statusById;
  filterCriteriaCount = 0;

  set showUsernameColumn(value: boolean) {
    this.setShowColumn('username', value);
  }

  set showUsernameExtranetColumn(value: boolean) {
    this.setShowColumn('usernameExtranet', value);
  }

  @ViewChild(MatExpansionPanel, {static: true}) filterExpansionPanel: MatExpansionPanel;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: PlatformService,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected accountService: AccountService,
    protected settings: LocalSettingsService,
    protected validatorService: ValidatorService,
    protected configService: ConfigService,
    protected dataService: PersonService,
    protected cd: ChangeDetectorRef,
    formBuilder: FormBuilder,
    injector: Injector,
    @Inject(ENVIRONMENT) environment
  ) {
    super(route, router, platform, location, modalCtrl, settings,
      RESERVED_START_COLUMNS
        .concat([
          'avatar',
          'lastName',
          'firstName',
          'email',
          'profile',
          'status',
          'username',
          'usernameExtranet',
          'pubkey'
        ])
        .concat(accountService.additionalFields.map(field => field.key))
        .concat(RESERVED_END_COLUMNS),
      new EntitiesTableDataSource(Person, dataService, validatorService, {
        prependNewElements: false,
        suppressErrors: environment.production,
        dataServiceOptions: {
          saveOnlyDirtyRows: true
        }
      }),
      null,
      injector
    );


    this.inlineEdition = accountService.isAdmin(); // Allow inline edition only if admin
    this.canEdit = accountService.isAdmin();
    this.confirmBeforeDelete = true;
    this.autoLoad = false; // Wait config loading
    this.i18nColumnPrefix = 'USER.';
    this.defaultSortBy = 'lastName';
    this.defaultSortDirection = 'asc';

    this.filterForm = formBuilder.group({
      searchText: [null],
      statusId: [null]
    });

    // Fill statusById
    this.statusById = {};
    this.statusList.forEach((status) => this.statusById[status.id] = status);

    this.additionalFields = (this.accountService.additionalFields || [])
      .filter(field => isNotNil(field.autocomplete))
      .map(field => {
        // Make sure to get the final autocomplete config (e.g. with a suggestFn function)
        field.autocomplete = this.registerAutocompleteField(field.key, {
          ...field.autocomplete // Copy, to be sure the original config is unchanged
        });
        return field;
      });

    // For DEV only --
    this.debug = !environment.production;
  }

  ngOnInit() {
    super.ngOnInit();

    this.registerSubscription(
      this.configService.config.subscribe(config => {
        const authTokenType = config.getProperty(CORE_CONFIG_OPTIONS.AUTH_TOKEN_TYPE) as AuthTokenType;
        console.debug('[users] AuthTokenType=' + authTokenType)
        switch (authTokenType) {
          case "basic":
            this.setShowColumn('pubkey', false, {emitEvent: false});
          case "basic-and-token":
            this.setShowColumn('username', true, {emitEvent: false});
            this.setShowColumn('usernameExtranet', true, {emitEvent: false});
            break;
          case "token":
            this.setShowColumn('pubkey', true, {emitEvent: false});
            this.setShowColumn('username', false, {emitEvent: false});
            this.setShowColumn('usernameExtranet', false, {emitEvent: false});
        }
        this.updateColumns();
        this.onRefresh.emit();
      })
    )

    this.registerSubscription(
      this.onRefresh.subscribe(() => {
        this.filterForm.markAsUntouched();
        this.filterForm.markAsPristine();
      }));

    // Update filter when changes
    this.registerSubscription(
      this.filterForm.valueChanges
        .pipe(
          debounceTime(250),
          filter(() => this.filterForm.valid),
          tap(json => {
            const filter = PersonFilter.fromObject(json);
            this.filterCriteriaCount = filter.countNotEmptyCriteria();
            this.markForCheck();
            // Update the filter, without reloading the content
            this.setFilter(filter, {emitEvent: false});
          }),
          // Save filter in settings (after a debounce time)
          debounceTime(500),
          tap(json => this.settings.savePageSetting(this.settingsId, json, SETTINGS_FILTER))
        )
        .subscribe());

    // Restore filter from settings, or load all
    this.restoreFilterOrLoad();
  }

  applyFilterAndClosePanel(event?: UIEvent) {
    this.onRefresh.emit(event);
    this.filterExpansionPanel.close();
  }

  resetFilter(event?: UIEvent) {
    this.totalRowCount = undefined;
    this.filterCriteriaCount = 0;
    this.markAsLoading();
    this.filterForm.reset();
    this.setFilter(null);
  }

  protected async restoreFilterOrLoad() {
    this.markAsLoading();

    console.debug("[users] Restoring filter from settings...");

    const json = this.settings.getPageSettings(this.settingsId, SETTINGS_FILTER) || {};
    const filter = PersonFilter.fromObject(json);

    this.filterForm.patchValue(json);
    this.setFilter(filter, {emitEvent: true});
  }

  clearControlValue(event: UIEvent, formControl: AbstractControl): boolean {
    if (event) event.stopPropagation(); // Avoid to enter input the field
    formControl.setValue(null);
    return false;
  }

  referentialToString = referentialToString;

  /* -- protected methods -- */

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

