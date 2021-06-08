import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot, UrlTree} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {AlertController} from '@ionic/angular';
import {Alerts} from '../alerts';

export interface CanLeave {
  dirty: boolean;
  valid: boolean;
  save(event?: Event, options?: any): Promise<boolean>;
  cancel(event?: Event): Promise<void>;
}

@Injectable()
export class ComponentDirtyGuard implements CanDeactivate<CanLeave> {

  private debug = false;

  constructor(
    protected translate: TranslateService,
    protected alertCtrl: AlertController,
  ) {
  }

  async canDeactivate(component: CanLeave, currentRoute: ActivatedRouteSnapshot, currentState: RouterStateSnapshot, nextState?: RouterStateSnapshot):
    Promise<boolean | UrlTree> {

    const dirty = component.dirty;
    const valid = component.valid;
    let can = {
      confirmed: !dirty,
      save: false,
    };

    if (this.debug) {
      console.debug(`[dirty-guard] canDeactivate component dirty: ${dirty}, valid: ${valid}`);
    }

    if (dirty) {
      // Ask confirmation
      can = await Alerts.askSaveBeforeAction(this.alertCtrl, this.translate, {valid});
    }

    if (this.debug) console.debug(`[dirty-guard] confirm: ${can.confirmed}`);

    if (can.confirmed) {
      if (can.save) {
        if (this.debug) console.debug(`[dirty-guard] do save`);
        const saved = await component.save();
        if (!saved) {
          if (this.debug) console.debug(`[dirty-guard] save failed, cancel deactivate`);
          return false;
        }
      } else {
        if (this.debug) console.debug(`[dirty-guard] do cancel`);
        if (dirty)
          component.cancel();
      }

      // Allow deactivate
      return true;
    }

    // Cancel deactivate
    return false;

  }


}
