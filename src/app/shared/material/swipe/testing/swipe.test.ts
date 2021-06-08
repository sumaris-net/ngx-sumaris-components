import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {SharedValidators} from '../../../validator/validators';
import * as momentImported from 'moment';
const moment = momentImported;
import {BehaviorSubject} from 'rxjs';
import {Moment} from 'moment';
import {DateFormatPipe} from '../../../pipes/date-format.pipe';
import {DisplayFn} from '../../../form/field.model';
import {distinctUntilChanged} from 'rxjs/operators';

@Component({
  selector: 'app-swipe-test',
  templateUrl: './swipe.test.html'
})
export class SwipeTestPage implements OnInit {

  form: FormGroup;

  $dates = new BehaviorSubject<Moment[]>(undefined);
  private _today = moment().startOf('day');

  constructor(
    protected formBuilder: FormBuilder,
    protected dateFormatPipe: DateFormatPipe
  ) {
    this.form = formBuilder.group({
      empty: [null, Validators.required],
      date: [null, Validators.compose([Validators.required, SharedValidators.validDate])],
      disabledEmpty: [null, Validators.required],
      disabledDate: [null, Validators.required]
    });

    this.form.get('disabledEmpty').disable();
    this.form.get('disabledDate').disable();

  }

  ngOnInit() {

    const dates: Moment[] = [];
    for (let d = 0; d < 7; d++) {
      dates[d] = moment(this._today).add(d-3, 'day');
    }
    this.$dates.next(dates);


    this.loadData();
    //setTimeout(() => this.loadData(), 1500);

    this.form.valueChanges.pipe(
      distinctUntilChanged()
    ).subscribe(() => console.debug(this.form.value));
  }

  // Load the form with data
  async loadData() {
    const data = {
      empty: null,
      date: this._today,
      disabledEmpty: null,
      disabledDate: this._today
    };

    this.form.patchValue(data);
  }

  doSubmit(event) {
    console.debug('Validate form: ', this.form.value);
  }

  /* -- protected methods -- */

  displayDate(): DisplayFn {
    return (obj: any) => this.dateFormatPipe.transform(obj, {pattern: 'dddd L'}).toString();
  }

  compareDate() {
    return (d1: Moment, d2: Moment) => d1 && d2 && d1.isSame(d2) || false;
  }
}

