import {Component, Inject, InjectionToken, Optional} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {capitalizeFirstLetter} from '../../shared/functions';
import {Department} from '../services/model/department.model';
import {Person} from '../services/model/person.model';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from '../services/config.service';
import {Configuration} from '../services/model/config.model';
import {Observable} from 'rxjs';

export const APP_ABOUT_DEVELOPERS = new InjectionToken<Partial<Department>[]>('aboutDevelopers');
export const APP_ABOUT_PARTNERS = new InjectionToken<Partial<Department>[]>('aboutPartners');

@Component({
  selector: 'modal-about',
  styleUrls: ['./modal-about.scss'],
  templateUrl: './modal-about.html'
})
export class AboutModal {

  readonly name: string;
  readonly version: string;
  readonly sourceUrl: string;
  readonly reportIssueUrl: string;
  readonly config$: Observable<Configuration>;

  constructor(
    protected translate: TranslateService,
    protected modalController: ModalController,
    protected configService: ConfigService,
    @Optional() @Inject(ENVIRONMENT) environment,
    @Optional() @Inject(APP_ABOUT_DEVELOPERS) public developers: Partial<Department>[],
    @Optional() @Inject(APP_ABOUT_PARTNERS) public partners: Partial<Department>[]
  ) {
    this.name = translate.instant('APP_NAME');
    if (this.name === 'APP_NAME') {
      // Not translated: use name from the environnement
      this.name = environment && environment.name && capitalizeFirstLetter(environment.name) || undefined;
    }
    this.version = environment && environment.version;
    this.sourceUrl = environment && environment.sourceUrl;
    this.reportIssueUrl = environment && environment.reportIssueUrl;
    this.config$ = configService.config
  }

  async close() {
      await this.modalController.dismiss();
  }
}
