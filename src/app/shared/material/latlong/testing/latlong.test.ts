import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {SharedValidators} from '../../../validator/validators';


@Component({
  selector: 'app-latlong-test',
  templateUrl: './latlong.test.html'
})
export class LatLongTestPage implements OnInit {


  form: FormGroup;

  constructor(
    protected formBuilder: FormBuilder
  ) {
    this.form = formBuilder.group({
      empty: formBuilder.group({
        latitude: [null, Validators.compose([Validators.required, SharedValidators.latitude])],
        longitude: [null, Validators.compose([Validators.required, SharedValidators.longitude])]
      }),
      enable: formBuilder.group({
        latitude: [null, SharedValidators.latitude],
        longitude: [null, SharedValidators.longitude]
      }),
      disable: formBuilder.group({
        latitude: [null, SharedValidators.latitude],
        longitude: [null, SharedValidators.longitude]
      })
    });

    const disableFormGroup = this.form.get('disable');
    disableFormGroup.disable();

    // Copy enable value to disable form
    this.form.get('enable').valueChanges.subscribe(value => disableFormGroup.setValue(value));

  }

  ngOnInit() {


    setTimeout(() => this.loadData(), 250);
  }

  // Load the form with data
  async loadData() {
    const data = {
      empty: {
        latitude: null,
        longitude: null
      },
      enable: {
        latitude: 50.1,
        longitude: -2
      },
      disable: {
        latitude: 50.1,
        longitude: -2
      },
    };

    this.form.setValue(data);
  }

  doSubmit(event) {
    console.debug('Validate form: ', this.form.value);
  }

  geoPosition(event: UIEvent): boolean {
    console.debug('Click on geoLocation button', event);
    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  stringify = JSON.stringify;

  /* -- protected methods -- */


}

