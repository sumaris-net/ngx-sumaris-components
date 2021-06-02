import {TestBed} from '@angular/core/testing';
import {TranslateModule} from "@ngx-translate/core";
import {IonicStorageModule} from "@ionic/storage";
import {NetworkService} from "./network.service";
import {ModalController} from "@ionic/angular";
import {HttpClientModule} from "@angular/common/http";
import {SplashScreen} from "@ionic-native/splash-screen";
import {Network} from "@ionic-native/network/ngx";
import {CacheModule} from "ionic-cache";
import {of} from "rxjs";

describe('NetworkService', () => {
  // service to test
  let service: NetworkService;

  // some mocks
  let modalSpy = jasmine.createSpyObj('Modal', ['present', 'onDidDismiss']);
  let modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);
  modalCtrlSpy.create.and.callFake(function () {
    return modalSpy;
  });
  let splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide']);
  let networkSpy = jasmine.createSpyObj('Network', ['onConnect', 'onDisconnect']);
  networkSpy.onConnect.and.callFake(() => of(true));
  networkSpy.onDisconnect.and.callFake(() => of(true));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        IonicStorageModule.forRoot(),
        HttpClientModule,
        CacheModule.forRoot()
      ],
      providers: [
        {provide: ModalController, useValue: modalCtrlSpy},
        {provide: SplashScreen, useValue: splashScreenSpy},
        {provide: Network, useValue: networkSpy},
        NetworkService
      ]
    });
    service = TestBed.inject(NetworkService);
  });

  it('should be created and started', async () => {
    expect(service).toBeTruthy();
    await service.ready();
    expect(service.started).toBeTrue();
  });

});
