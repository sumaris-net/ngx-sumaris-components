import {Component, OnDestroy} from '@angular/core';
import {Subscription} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {AccountService} from '../../services/account.service';
import {getRandomImage} from '../../home/home';
import {ConfigService} from '../../services/config.service';
import {PlatformService} from '../../services/platform.service';

@Component({
  selector: 'page-register-confirm',
  templateUrl: 'confirm.html',
  styleUrls: ['./confirm.scss']
})
export class RegisterConfirmPage implements OnDestroy {

  subscriptions: Subscription[] = [];

  isLogin: boolean;
  loading = true;
  error: string;
  email: string;
  contentStyle = {};

  constructor(
    private platform: PlatformService,
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private configService: ConfigService) {

    this.platform.ready().then(() => {
      this.isLogin = accountService.isLogin();

      // Subscriptions
      this.subscriptions.push(this.accountService.onLogin.subscribe(account => this.isLogin = true));
      this.subscriptions.push(this.accountService.onLogout.subscribe(() => this.isLogin = false));
      this.subscriptions.push(this.activatedRoute.paramMap.subscribe(params =>
        this.doConfirm(params.get('email'), params.get('code'))
      ));

      this.configService.config.subscribe(config => {

        if (config && config.backgroundImages && config.backgroundImages.length) {
          const bgImage = getRandomImage(config.backgroundImages);
          this.contentStyle = {'background-image': `url(${bgImage})`};
        } else {
          const primaryColor = config.properties && config.properties['sumaris.color.primary'] || '#144391';
          this.contentStyle = {'background-color': primaryColor};
        }

        this.loading = false;
      });
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
  }

  async doConfirm(email: string, code: string) {
    this.email = email;

    if (!code) {
      this.loading = false;
      this.error = undefined;
      return;
    }

    try {
      if (this.accountService.isLogin()) {
        const account = this.accountService.account;
        const emailAccount = account && account.email;
        if (email != emailAccount) {
          // Not same email => logout, then retry
          await this.accountService.logout();
          return this.doConfirm(email, code);
        }
      }

      // Send the confirmation code
      const confirmed = await this.accountService.confirmEmail(email, code);
      if (confirmed && this.isLogin) {
        await this.accountService.refresh();
      }
      this.loading = false;
      //this.location.replaceState("/confirm/" + email + "/");
    }
    catch (err) {
      this.error = err && err.message || err;
      this.loading = false;
    }

  }
}
