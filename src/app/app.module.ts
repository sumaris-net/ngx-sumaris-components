import './vendor';

import {APP_BASE_HREF} from '@angular/common';
import {BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule} from '@angular/platform-browser';
import {CUSTOM_ELEMENTS_SCHEMA, NgModule, SecurityContext} from '@angular/core';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {MomentDateAdapter} from '@angular/material-moment-adapter';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Keyboard} from '@ionic-native/keyboard/ngx';
import {NativeAudio} from '@ionic-native/native-audio/ngx';
import {Vibration} from '@ionic-native/vibration/ngx';
import {Camera} from '@ionic-native/camera/ngx';
import {Network} from '@ionic-native/network/ngx';
import {AudioManagement} from '@ionic-native/audio-management/ngx';
import {InAppBrowser} from '@ionic-native/in-app-browser/ngx';
import {APP_LOCAL_SETTINGS, APP_LOCAL_SETTINGS_OPTIONS} from './core/services/local-settings.service';
import {APP_LOCALES, LocalSettings} from './core/services/model/settings.model';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {APP_CONFIG_OPTIONS} from './core/services/config.service';
import {IonicStorageModule} from '@ionic/storage';
import {APP_MENU_ITEMS} from './core/menu/menu.component';
import {APP_HOME_BUTTONS} from './core/home/home';
import {CORE_CONFIG_OPTIONS} from './core/services/config/core.config';
import {APP_TESTING_PAGES} from './shared/material/testing/material.testing.page';
import {IonicModule} from '@ionic/angular';
import {CacheModule} from 'ionic-cache';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {SharedModule} from './shared/shared.module';
import {MarkdownModule, MarkedOptions} from 'ngx-markdown';
import {APP_LOCAL_STORAGE_TYPE_POLICIES} from './core/services/storage/entities-storage.service';
import {AppGestureConfig} from './shared/gesture/gesture-config';
import {APP_GRAPHQL_TYPE_POLICIES} from './core/graphql/graphql.service';
import {SocialModule} from './social/social.module';
import {DATE_ISO_PATTERN} from './shared/constants';
import {JDENTICON_CONFIG} from 'ngx-jdenticon';
import {APP_ABOUT_DEVELOPERS, APP_ABOUT_PARTNERS} from './core/about/modal-about';
import {Department} from './core/services/model/department.model';
import {CORE_TESTING_PAGES} from './core/core.testing.module';
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {CoreModule} from './core/core.module';
import {environment} from '../environments/environment';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    IonicModule.forRoot(),
    CacheModule.forRoot(),
    IonicStorageModule.forRoot({
      name: 'ngx-sumaris-components', // default
      ...environment.storage
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (httpClient) => new TranslateHttpLoader(httpClient, './assets/i18n/', `.json`),
        deps: [HttpClient]
      }
    }),
    MarkdownModule.forRoot({
      loader: HttpClient, // Allow to load using [src]
      sanitize: SecurityContext.NONE,
      markedOptions: {
        provide: MarkedOptions,
        useValue: {
          gfm: true,
          breaks: false,
          pedantic: false,
          smartLists: true,
          smartypants: false,
        },
      }
    }),

    // functional modules
    CoreModule.forRoot(),
    SharedModule.forRoot(environment),
    SocialModule.forRoot(),
    HammerModule,
    AppRoutingModule
  ],
  providers: [
    StatusBar,
    SplashScreen,
    Keyboard,
    Camera,
    Network,
    NativeAudio,
    Vibration,
    InAppBrowser,
    AudioManagement,

    //{provide: APP_BASE_HREF, useValue: (environment.baseUrl || '/')},
    {provide: APP_BASE_HREF, useFactory: () => {
        try {
          return document.getElementsByTagName('base')[0].href;
        }
        catch (err) {
          console.error(err);
          return environment.baseUrl || '/';
        }
      }
    },
    //{ provide: ErrorHandler, useClass: IonicErrorHandler },

    {
      provide: APP_LOCALES, useValue:
        [
          {
            key: 'fr',
            value: 'Français',
            country: 'fr'
          },
          {
            key: 'en',
            value: 'English (UK)',
            country: 'gb'
          },
          {
            key: 'en-US',
            value: 'English (US)',
            country: 'us'
          }
        ]
    },

    {provide: MAT_DATE_LOCALE, useValue: 'en'},
    {
      provide: MAT_DATE_FORMATS, useValue: {
        parse: {
          dateInput: DATE_ISO_PATTERN,
        },
        display: {
          dateInput: 'L',
          monthYearLabel: 'MMM YYYY',
          dateA11yLabel: 'LL',
          monthYearA11yLabel: 'MMMM YYYY',
        }
      }
    },
    {provide: MomentDateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE, MAT_DATE_FORMATS]},
    {provide: DateAdapter, useExisting: MomentDateAdapter},

    // Configure hammer gesture
    {provide: HAMMER_GESTURE_CONFIG, useClass: AppGestureConfig},

    // Settings default values
    {
      provide: APP_LOCAL_SETTINGS, useValue: <Partial<LocalSettings>>{
        pageHistoryMaxSize: 3
      }
    },

    // Settings options definition
    {
      provide: APP_LOCAL_SETTINGS_OPTIONS, useValue: {} // Empty
    },

    // Config options definition (Core + trip)
    {provide: APP_CONFIG_OPTIONS, useValue: CORE_CONFIG_OPTIONS},

    // Menu items
    {
      provide: APP_MENU_ITEMS, useValue: [
        {title: 'MENU.HOME', path: '/', icon: 'home'},

        // Admin
        {title: 'MENU.ADMINISTRATION_DIVIDER', profile: 'ADMIN'},
        {title: 'MENU.USERS', path: '/admin/users', icon: 'people', profile: 'ADMIN'},

        // Settings
        {title: '' /*empty divider*/, cssClass: 'flex-spacer'},
        {title: 'MENU.TESTING', path: '/testing', icon: 'code', color: 'danger', ifProperty: 'sumaris.testing.enable', profile: 'SUPERVISOR'},
        {title: 'MENU.LOCAL_SETTINGS', path: '/settings', icon: 'settings', color: 'medium'},
        {title: 'MENU.ABOUT', action: 'about', matIcon: 'help_outline', color: 'medium', cssClass: 'visible-mobile'},

        // Logout
        {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'medium hidden-mobile'},
        {title: 'MENU.LOGOUT', action: 'logout', icon: 'log-out', profile: 'GUEST', color: 'danger visible-mobile'}

      ]
    },

    // Home buttons
    {provide: APP_HOME_BUTTONS, useValue: []},

    // Entities Apollo cache options
    {provide: APP_GRAPHQL_TYPE_POLICIES, useValue: {}},

    // Entities storage options
    {provide: APP_LOCAL_STORAGE_TYPE_POLICIES, useValue: {}},

    // About developers
    {
      provide: APP_ABOUT_DEVELOPERS, useValue: <Partial<Department>[]>[
        {siteUrl: 'https://www.e-is.pro', logo: 'assets/img/logo/logo-eis_50px.png', label: 'Environmental Information Systems'}
      ]
    },

    // About partners
    {
      provide: APP_ABOUT_PARTNERS, useValue: <Partial<Department>[]>[
        {siteUrl: 'https://www.sumaris.net', logo: 'assets/img/logo/logo-sumaris.png'},
        {siteUrl: 'https://www.e-is.pro', logo: 'assets/img/logo/logo-eis_50px.png'}
      ]
    },

    // Testing pages
    {
      provide: APP_TESTING_PAGES, useValue: [
        ...CORE_TESTING_PAGES
      ]
    },

    // Custom identicon style
    // https://jdenticon.com/icon-designer.html?config=4451860010ff320028501e5a
    {
      provide: JDENTICON_CONFIG,
      useValue: {
        lightness: {
          color: [0.26, 0.80],
          grayscale: [0.30, 0.90],
        },
        saturation: {
          color: 0.50,
          grayscale: 0.46,
        },
        backColor: '#0000'
      }
    }
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {

  constructor() {
    console.debug('[app] Creating module');
  }
}
