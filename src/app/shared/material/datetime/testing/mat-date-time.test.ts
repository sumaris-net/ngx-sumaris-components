import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Platform} from '@ionic/angular';
import {debounceTime} from 'rxjs/operators';
import {SharedFormGroupValidators} from '../../../validator/validators';
import {AppFormUtils} from '../../../../core/form/form.utils';
import {toDateISOString} from '../../../dates';
import * as momentImported from 'moment';
import Timer = NodeJS.Timer;

const moment = momentImported;

@Component({
  selector: 'app-data-time-test',
  templateUrl: './mat-date-time.test.html'
})
export class DateTimeTestPage implements OnInit {


  showLogPanel = true;
  logContent = '';

  memoryHide = false;
  memoryMobile = true;
  memoryTimer: Timer;

  form: FormGroup;

  constructor(
    protected platform: Platform,
    protected formBuilder: FormBuilder,
    protected cd: ChangeDetectorRef
  ) {
    this.form = formBuilder.group({
      empty: [null, Validators.required],
      enable: [null, Validators.required],
      disable: [null, Validators.required]
    }, {
      validators: SharedFormGroupValidators.dateRange('empty', 'enable')
    });

    const disableControl = this.form.get('disable');
    disableControl.disable();

    // Copy the 'enable' value, into the disable control
    this.form.get('enable').valueChanges.subscribe(value => disableControl.setValue(value));

    const mobile = platform.is('mobile');
    this.showLogPanel = this.showLogPanel || mobile;

  }

  ngOnInit() {

    setTimeout(() => this.loadData(), 250);


  }

  // Load the form with data
  async loadData() {
    const now = moment();
    const data = {
      empty: toDateISOString(now.clone().add(2, 'hours')),
      enable: toDateISOString(now),
      disable: now,
    };

    this.form.setValue(data);

    this.log('[test-page] Data loaded: ' + JSON.stringify(data));

    this.form.get('empty').valueChanges
      .pipe(debounceTime(300))
      .subscribe(value => this.log('[test-page] Value n°1: ' + JSON.stringify(value)));

    this.form.get('enable').valueChanges
      .pipe(debounceTime(300))
      .subscribe(value => this.log('[test-page] Value n°2: ' + JSON.stringify(value)));
  }

  doSubmit(event) {
    this.form.markAllAsTouched();
    this.log('[test-page] Form content: ' + JSON.stringify(this.form.value));
    this.log('[test-page] Form status: ' + this.form.status);
    if (this.form.invalid) {
      this.log('[test-page] Form errors: ' + JSON.stringify(this.form.errors));

      // DEBUG
      AppFormUtils.logFormErrors(this.form);
    }
  }

  log(message: string) {
    console.debug(message);

    if (this.showLogPanel) {
      this.logContent += message + '<br/>';
      this.cd.markForCheck();
    }
  }

  clearLogPanel() {
    this.logContent = '';
    this.cd.markForCheck();
  }

  startMemoryTimer() {
    this.memoryTimer = setInterval(() => {
      this.memoryHide = !this.memoryHide;
    }, 50);
  }

  stopMemoryTimer() {
    clearInterval(this.memoryTimer);
    this.memoryTimer = null;
    this.memoryHide = false;
  }

  stringify = JSON.stringify;

  /* -- protected methods -- */


}

