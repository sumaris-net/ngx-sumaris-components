import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Inject, InjectionToken, Input, OnInit, Optional, ViewChild} from '@angular/core';
import {AlertController, IonSplitPane, MenuController, ModalController} from '@ionic/angular';

import {Router} from '@angular/router';
import {Account} from '../services/model/account.model';
import {UserProfileLabel} from '../services/model/person.model';
import {Configuration} from '../services/model/config.model';
import {AccountService} from '../services/account.service';
import {AboutModal} from '../about/modal-about';

import {fadeInAnimation} from '../../shared/material/material.animations';
import {TranslateService} from '@ngx-translate/core';
import {isNotNilOrBlank} from '../../shared/functions';
import {BehaviorSubject, merge, Subscription} from 'rxjs';
import {ConfigService} from '../services/config.service';
import {mergeMap, tap} from 'rxjs/operators';
import {HammerSwipeEvent} from '../../shared/gesture/hammer.utils';
import {PlatformService} from '../services/platform.service';
import {IconRef} from '../../shared/types';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {MenuService} from './menu.service';

export interface MenuItem extends IconRef {
  title: string;
  path?: string;
  action?: string | any;
  icon?: string;
  matIcon?: string;
  profile?: UserProfileLabel;
  exactProfile?: UserProfileLabel;
  color?: string;
  cssClass?: string;
  // A config property, to enable the menu item
  ifProperty?: string;
  // A config property, to override the title
  titleProperty?: string;
  titleArgs?: {[key: string]: string};
  children?: MenuItem[];
}

export class MenuItems {
  static checkIfVisible(item: MenuItem,
                        accountService: AccountService,
                        config: Configuration,
                        opts?: {
                          isLogin?: boolean;
                          debug?: boolean;
                          logPrefix?: string;
                        }): boolean {
    opts = opts || {};
    if (item.profile) {
      const hasProfile = accountService.isLogin() && accountService.hasMinProfile(item.profile);
      if (!hasProfile) {
        if (opts.debug) console.debug(`${opts && opts.logPrefix || '[menu]'} Hide item '${item.title}': need the min profile '${item.profile}' to access path '${item.path}'`);
        return false;
      }
    }

    else if (item.exactProfile) {
      const hasExactProfile =  accountService.hasExactProfile(item.exactProfile);
      if (!hasExactProfile) {
        if (opts.debug) console.debug(`${opts && opts.logPrefix || '[menu]'} Hide item '${item.title}': need exact profile '${item.exactProfile}' to access path '${item.path}'`);
        return false;
      }
    }

    // If enable by config
    if (item.ifProperty) {
      //console.debug("[menu] Checking if property enable ? " + item.ifProperty, config && config.properties);
      const isEnableByConfig = config && config.properties[item.ifProperty] === 'true';
      if (!isEnableByConfig) {
        if (opts.debug) console.debug('[menu] Config property \'' + item.ifProperty + '\' not \'true\' for ', item.path);
        return false;
      }
    }

    return true;
  }
}
