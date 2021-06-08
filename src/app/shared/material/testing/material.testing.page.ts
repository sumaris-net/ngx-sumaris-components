import {Component, Inject, InjectionToken, Optional} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';

export declare interface TestingPage {
  label: string;
  page: string;
}

export const APP_TESTING_PAGES = new InjectionToken<TestingPage[]>('testingPages');

@Component({
  selector: 'app-material-testing',
  templateUrl: './material.testing.html'
})
export class MaterialTestingPage {

  constructor(
      protected route: ActivatedRoute,
      protected router: Router,
      protected translate: TranslateService,
      @Optional() @Inject(APP_TESTING_PAGES) public pages: TestingPage[]
    ) {
    console.log('Testing pages:', pages);
  }

  async openPage(page): Promise<boolean> {
    return this.router.navigate([page], {
      relativeTo: this.route
    });
  }
}

