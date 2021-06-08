import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AutocompleteTestPage} from './autocomplete.test';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {AppModule} from '../../../../app.module';
import {SplashScreen} from '@ionic-native/splash-screen';
import {ReactiveFormsModule} from '@angular/forms';

describe('AutocompleteTestPage', () => {
  let component: AutocompleteTestPage;
  let fixture: ComponentFixture<AutocompleteTestPage>;
  const splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      schemas: [
        CUSTOM_ELEMENTS_SCHEMA
      ],
      imports: [
        ReactiveFormsModule
      ],
      providers: [
        {provide: SplashScreen, useValue: splashScreenSpy},
        AppModule
      ],
      declarations: [
        AutocompleteTestPage
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutocompleteTestPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
