import {Component, EventEmitter, Inject, OnInit, Output, ViewChild} from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import {AccountService, RegisterData} from '../../services/account.service';
import {Account} from '../../services/model/account.model';
import {referentialToString} from '../../services/model/referential.model';
import {MatHorizontalStepper} from '@angular/material/stepper';
import {Observable, Subscription, timer} from 'rxjs';
import {AccountValidatorService} from '../../services/validator/account.validator';
import {FormFieldDefinition} from '../../../shared/form/field.model';
import {mergeMap} from 'rxjs/operators';
import {LocalSettingsService} from '../../services/local-settings.service';
import {MatAutocompleteConfigHolder} from '../../../shared/material/autocomplete/material.autocomplete';
import {ENVIRONMENT} from '../../../../environments/environment.class';


@Component({
  selector: 'form-register',
  templateUrl: 'form-register.html',
  styleUrls: ['./form-register.scss']
})
export class RegisterForm implements OnInit {

  protected debug = false;

  autocompleteHelper: MatAutocompleteConfigHolder;
  additionalFields: FormFieldDefinition[];
  form: FormGroup;
  forms: FormGroup[];
  subscriptions: Subscription[] = [];
  error: string;
  sending = false;

  showPwd = false;
  showConfirmPwd = false;

  @ViewChild('stepper', { static: true }) private stepper: MatHorizontalStepper;

  @Output()
  onCancel = new EventEmitter<any>();

  @Output()
  onSubmit = new EventEmitter<RegisterData>();

  constructor(
    private accountService: AccountService,
    private accountValidatorService: AccountValidatorService,
    public formBuilder: FormBuilder,
    @Inject(ENVIRONMENT) protected environment,
    protected settings?: LocalSettingsService
  ) {


    this.forms = [];
    // Email form
    this.forms.push(formBuilder.group({
      email: new FormControl(null, Validators.compose([Validators.required, Validators.email]), this.emailAvailability(this.accountService)),
      confirmEmail: new FormControl(null, Validators.compose([Validators.required, this.equalsValidator('email')]))
    }));

    // Password form
    this.forms.push(formBuilder.group({
      password: new FormControl(null, Validators.compose([Validators.required, Validators.minLength(8)])),
      confirmPassword: new FormControl(null, Validators.compose([Validators.required, this.equalsValidator('password')]))
    }));

    // Detail form
    const formDetailDef = {
      lastName: new FormControl(null, Validators.compose([Validators.required, Validators.minLength(2)])),
      firstName: new FormControl(null, Validators.compose([Validators.required, Validators.minLength(2)]))
    };

    // Prepare autocomplete settings
    this.autocompleteHelper = new MatAutocompleteConfigHolder(settings && {
      getUserAttributes: (a, b) => settings.getFieldDisplayAttributes(a, b)
    });


    // Add additional fields to details form
    this.additionalFields = this.accountService.additionalFields
      // Keep only required fields
      .filter(field => field.extra && field.extra.registration && field.extra.registration.required);
    this.additionalFields.forEach(field => {
      //if (this.debug) console.debug("[register-form] Add additional field {" + field.name + "} to form", field);
      formDetailDef[field.key] = new FormControl(null, this.accountValidatorService.getValidators(field));

      if (field.type === 'entity') {
        field.autocomplete = this.autocompleteHelper.add(field.key, field.autocomplete);
      }

    });

    this.forms.push(formBuilder.group(formDetailDef));

    this.form = formBuilder.group({
      emailStep: this.forms[0],
      passwordStep: this.forms[1],
      detailsStep: this.forms[2]
    });
  }

  ngOnInit() {
    // For DEV only ------------------------
    if (!this.environment.production) {
      this.form.setValue({
        emailStep: {
          email: 'contact@e-is.pro',
          confirmEmail: 'contact@e-is.pro'
        },
        passwordStep: {
          password: 'contactera',
          confirmPassword: 'contactera'
        },
        detailsStep: {
          lastName: 'Lavenier 2',
          firstName: 'Benoit',
          department: null
        }
      });
    }
  }

  get value(): RegisterData {
    const result: RegisterData = {
      username: this.form.value.emailStep.email,
      password: this.form.value.passwordStep.password,
      account: new Account()
    };
    result.account.fromObject(this.form.value.detailsStep);
    result.account.email = result.username;

    return result;
  }

  get valid(): boolean {
    return this.form.valid;
  }

  isEnd(): boolean {
    return this.stepper.selectedIndex === 2;
  }

  isBeginning(): boolean {
    return this.stepper.selectedIndex === 0;
  }

  slidePrev() {
    return this.stepper.previous();
  }

  slideNext(event?: UIEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    return this.stepper.next();
  }

  equalsValidator(otherControlName: string): ValidatorFn {
    return function(c: AbstractControl): ValidationErrors | null {
      if (c.parent && c.value !== c.parent.value[otherControlName]) {
        return {
          equals: true
        };
      }
      return null;
    };
  }

  emailAvailability(accountService: AccountService): AsyncValidatorFn {
    return function(control: AbstractControl): Observable<ValidationErrors | null> {

      return timer(500).pipe(mergeMap(() => accountService.checkEmailAvailable(control.value)
          .then(res => null)
          .catch(err => {
            console.error(err);
            return { availability: true };
          })));
    };
  }

  cancel() {
    this.onCancel.emit();
  }

  doSubmit(event?: any) {
    if (this.form.invalid) return;
    this.sending = true;
    this.onSubmit.emit(this.value);
  }

  referentialToString = referentialToString;

  markAsTouched() {
    this.form.markAsTouched();
  }

  disable() {
    this.form.disable();
  }

  enable() {
    this.form.enable();
  }
}
