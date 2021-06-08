import {DurationPipe} from './duration.pipe';
import {TestBed} from '@angular/core/testing';
import {
  MissingTranslationHandler,
  MissingTranslationHandlerParams,
  TranslateModule
} from '@ngx-translate/core';
import {HttpClientModule} from '@angular/common/http';
import {Injectable} from '@angular/core';

describe('DurationPipe', () => {

  let pipe: DurationPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
        TranslateModule.forRoot({
          missingTranslationHandler: {provide: MissingTranslationHandler, useClass: DummyMissingTranslationHandler}
        })
      ],
      providers: [
        DurationPipe
      ]
    });
    pipe = TestBed.inject(DurationPipe);
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('transform some values', () => {
    expect(pipe.transform(1)).not.toBe('1:00');
    expect(pipe.transform(1)).toBe('01:00');
    expect(pipe.transform(10)).toBe('10:00');
    expect(pipe.transform(1.5)).toBe('01:30');
    expect(pipe.transform(2.9)).toBe('02:54');
    expect(pipe.transform(24)).toBe('1DUMMY 00:00');
    expect(pipe.transform(25.25)).toBe('1DUMMY 01:15');
  });
});

@Injectable()
class DummyMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): any {
    return 'DUMMY';
  }
}
