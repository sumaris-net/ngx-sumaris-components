import {MatStepperIntl} from '@angular/material/stepper';
import {TranslateService} from '@ngx-translate/core';
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class MatStepperI18n extends MatStepperIntl {

  constructor(private translate: TranslateService) {
    super();
    translate.onLangChange.subscribe(() => this.translateLabels());

    this.translateLabels();
  }

  private translateLabels() {
    this.optionalLabel = this.translate.instant('COMMON.OPTIONAL');
  }
}
