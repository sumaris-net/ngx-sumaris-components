import {Component, Inject, InjectionToken, Optional} from "@angular/core";
import {ModalController} from "@ionic/angular";
import {ENVIRONMENT} from "../../../environments/environment.class";
import {Department} from "../services/model/department.model";
import {Person} from "../services/model/person.model";

export const APP_ABOUT_DEVELOPERS = new InjectionToken<Partial<Department>[]>('aboutDevelopers');
export const APP_ABOUT_PARTNERS = new InjectionToken<Partial<Department>[]>('aboutPartners');

@Component({
  selector: 'modal-about',
  styleUrls: ['./modal-about.scss'],
  templateUrl: './modal-about.html'
})
export class AboutModal {

  readonly appVersion: string;
  readonly sourceUrl: string;
  readonly reportIssueUrl: string;

  constructor(
      protected modalController: ModalController,
      @Inject(ENVIRONMENT) protected environment,
      @Optional() @Inject(APP_ABOUT_DEVELOPERS) public developers: Partial<Department>[],
      @Optional() @Inject(APP_ABOUT_PARTNERS) public partners: Partial<Department>[]
  ) {
    this.appVersion = environment.version;
    this.sourceUrl = environment.sourceUrl;
    this.reportIssueUrl = environment.reportIssueUrl;
  }

  async close() {
      await this.modalController.dismiss();
  }
}
