import {TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {ModalController, Platform} from '@ionic/angular';
import {HttpClientModule} from '@angular/common/http';
import {SplashScreen} from '@ionic-native/splash-screen';
import {Network} from '@ionic-native/network/ngx';
import {CacheModule} from 'ionic-cache';
import {of} from 'rxjs';
import {PlatformService} from './platform.service';
import {NetworkService} from './network.service';
import {AudioProvider} from '../../shared/audio/audio';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {Keyboard} from '@ionic-native/keyboard/ngx';
import {PlatformModule} from '@angular/cdk/platform';

describe('PlatformService', () => {
  // service to test
  let service: PlatformService;

  // some mocks
  const platformSpy = jasmine.createSpyObj('Platform', ['url']);
  const modalSpy = jasmine.createSpyObj('Modal', ['present', 'onDidDismiss']);
  const modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);
  modalCtrlSpy.create.and.callFake(function() {
    return modalSpy;
  });
  const splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide']);
  const keyboardSpy = jasmine.createSpyObj('Keyboard', ['hideFormAccessoryBar']);
  const statusBarSpy = jasmine.createSpyObj('StatusBar', ['styleDefault', 'overlaysWebView']);
  const networkSpy = jasmine.createSpyObj('Network', ['onConnect', 'onDisconnect']);
  networkSpy.onConnect.and.callFake(() => of(true));
  networkSpy.onDisconnect.and.callFake(() => of(true));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        // IonicStorageModule.forRoot(),
        HttpClientModule,
        PlatformModule,
        CacheModule.forRoot()
      ],
      providers: [
        {provide: ModalController, useValue: modalCtrlSpy},
        {provide: SplashScreen, useValue: splashScreenSpy},
        {provide: Keyboard, useValue: keyboardSpy},
        {provide: StatusBar, useValue: statusBarSpy},
        {provide: Network, useValue: networkSpy},
        // {provide: Platform, useValue: platformSpy},
        NetworkService,
        AudioProvider,
        PlatformService
      ]
    });
    service = TestBed.inject(PlatformService);
  });

  it('should be created and started', async () => {
    expect(service).toBeTruthy();
    await service.ready();
    expect(service.started).toBeTrue();
  });

});
