import { TestBed } from '@angular/core/testing';
import {LocalSettingsService} from './local-settings.service';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {IonicStorageModule} from '@ionic/storage';
import {LocalSettings} from './model/settings.model';

describe('LocalSettingsService', () => {
  let service: LocalSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        IonicStorageModule.forRoot()
      ],
      providers: [
        LocalSettingsService
      ]
    });
    service = TestBed.inject(LocalSettingsService);
  });

  it('should be created', async () => {
    expect(service).toBeTruthy();
    const settings = await service.ready();
    expect(settings).toBeDefined();
    expect(settings.locale).toBeUndefined();
    expect(settings.latLongFormat).toBe('DDMM');
  });

});
