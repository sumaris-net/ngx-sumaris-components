import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from "@angular/core";
import {AppTable, AppTableDataSource, environment} from "../../../core/core.module";
import {Person, PRIORITIZED_USER_PROFILES, referentialToString, StatusIds} from "../../../core/services/model";
import {PersonFilter, PersonService} from "../../services/person.service";
import {PersonValidatorService} from "../../services/person.validator";
import {ModalController, Platform} from "@ionic/angular";
import {ActivatedRoute, Router} from "@angular/router";
import {AccountFieldDef, AccountService} from "../../../core/services/account.service";
import {Location} from '@angular/common';
import {FormBuilder, FormGroup} from "@angular/forms";
import {RESERVED_END_COLUMNS, RESERVED_START_COLUMNS} from "../../../core/table/table.class";
import {ValidatorService} from "angular4-material-table";
import {SaleValidatorService} from "../../../trip/services/sale.validator";
import {debounceTime, switchMap, tap} from "rxjs/operators";
import {TaxonGroupIds} from "../../../referential/services/model";

@Component({
  selector: 'page-configuration',
  templateUrl: 'users.html',
  styleUrls: ['./users.scss'],
  providers: [
    {provide: ValidatorService, useClass: PersonValidatorService}
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPage extends AppTable<Person, PersonFilter> implements OnInit {

  canEdit = false;
  filterForm: FormGroup;
  profiles: string[] = PRIORITIZED_USER_PROFILES;
  additionalFields: AccountFieldDef[];
  statusList: any[] = [
    {
      id: StatusIds.ENABLE,
      icon: 'checkmark',
      label: 'REFERENTIAL.STATUS_ENABLE'
    },
    {
      id: StatusIds.DISABLE,
      icon: 'close',
      label: 'REFERENTIAL.STATUS_DISABLE'
    },
    {
      id: StatusIds.TEMPORARY,
      icon: 'warning',
      label: 'REFERENTIAL.STATUS_TEMPORARY'
    }
  ];
  statusById;
  any;

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected platform: Platform,
    protected location: Location,
    protected modalCtrl: ModalController,
    protected accountService: AccountService,
    protected validatorService: ValidatorService,
    protected dataService: PersonService,
    protected cd: ChangeDetectorRef,
    formBuilder: FormBuilder
  ) {
    super(route, router, platform, location, modalCtrl, accountService,
      RESERVED_START_COLUMNS
        .concat([
          'avatar',
          'lastName',
          'firstName',
          'email',
          'profile',
          'status',
          'pubkey'
        ])
        .concat(accountService.additionalAccountFields.map(field => field.name))
        .concat(RESERVED_END_COLUMNS),
      new AppTableDataSource<Person, PersonFilter>(Person, dataService, validatorService, {
        prependNewElements: false,
        suppressErrors: false,
        serviceOptions: {
          saveOnlyDirtyRows: true
        }
      })
    );

    // Allow inline edition only if admin
    this.inlineEdition = accountService.isAdmin(); // TODO: only if desktop ?
    this.canEdit = accountService.isAdmin();

    this.i18nColumnPrefix = 'USER.';
    this.filterForm = formBuilder.group({
      'searchText': [null]
    });

    // Fill statusById
    this.statusById = {};
    this.statusList.forEach((status) => this.statusById[status.id] = status);

    this.additionalFields = this.accountService.additionalAccountFields;

    // For DEV only --
    this.debug = !environment.production;
  };

  ngOnInit() {
    super.ngOnInit();

    // Update filter when changes
    this.registerSubscription(
      this.filterForm.valueChanges.subscribe(() => {
        this.filter = this.filterForm.value;
      }));

    this.registerSubscription(
      this.onRefresh.subscribe(() => {
        this.filterForm.markAsUntouched();
        this.filterForm.markAsPristine();
        this.cd.markForCheck();
      }));

  }

  referentialToString = referentialToString;

  /* -- protected methods -- */

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

