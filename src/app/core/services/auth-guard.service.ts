import {Inject, Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {ModalController} from '@ionic/angular';
import {AuthModal} from '../auth/modal/modal-auth';
import {AccountService} from './account.service';
import {ENVIRONMENT} from '../../../environments/environment.class';

@Injectable({providedIn: 'root'})
export class AuthGuardService implements CanActivate {

  private readonly _debug: boolean;

  constructor(private accountService: AccountService,
              private modalCtrl: ModalController,
              private router: Router,
              @Inject(ENVIRONMENT) protected environment
  ) {
    this._debug = !environment.production;
  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean | UrlTree> | boolean | UrlTree {

    // If account not started: loop after started
    if (!this.accountService.started) {
      return this.accountService.ready()
        // Iterate
        .then(() => this.canActivate(next, state) as Promise<boolean | UrlTree>);
    }

    // Force login
    if (!this.accountService.isLogin()) {
      if (this._debug) console.debug('[auth-gard] Need authentication for page /' + next.url.join('/'));
      return this.login(next)
        .then(res => {
          if (!res) {
            if (this._debug) console.debug('[auth-gard] Authentication cancelled. Could not access to /' + next.url.join('/'));
            return this.router.parseUrl('/home');
          }
          // Iterate
          return this.canActivate(next, state) as Promise<boolean | UrlTree>;
        });
    }

    if (next.data && next.data.profile && !this.accountService.hasMinProfile(next.data.profile)) {
      if (this._debug) console.debug('[auth-gard] Not authorized access to /' + next.url.join('/') + '. Missing required profile: ' + next.data.profile);
      return false;
    }
    if (this._debug) console.debug('[auth-gard] Authorized access to /' + next.url.join('/'));
    return true;
  }

  login(next?: ActivatedRouteSnapshot): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const modal = await this.modalCtrl.create({component: AuthModal, componentProps: {next}});
      modal.onDidDismiss()
        .then(() => {
          if (this.accountService.isLogin()) {
            resolve(true);
            return;
          }
          resolve(false);
        });
      return modal.present();
    });
  }
}
