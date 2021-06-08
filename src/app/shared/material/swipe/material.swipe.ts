import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component, ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Output, Provider,
  ViewChild
} from '@angular/core';
import {ControlValueAccessor, FormControl, FormGroupDirective, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BehaviorSubject, isObservable, noop, Observable, Subscription} from 'rxjs';
import {
  isNil, isNotNil,
  joinPropertiesPath,
  toBoolean
} from '../../functions';
import {InputElement, selectInputContent} from '../../inputs';
import {CompareWithFn, DisplayFn} from '../../form/field.model';
import {FloatLabelType} from '@angular/material/form-field';
import {IonSlides} from '@ionic/angular';
import {MatButton} from '@angular/material/button';
import {firstNotNilPromise} from '../../observables';
import {filter} from 'rxjs/operators';

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatSwipeField),
  multi: true
};

@Component({
  selector: 'mat-swipe-field',
  styleUrls: ['./material.swipe.scss'],
  templateUrl: './material.swipe.html',
  providers: [DEFAULT_VALUE_ACCESSOR],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatSwipeField implements OnInit, InputElement, OnDestroy, ControlValueAccessor {

  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _value: any;
  private _subscription = new Subscription();
  private _itemsSubscription: Subscription;
  private _writing = false;
  private _tabindex: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  showSlides = false;
  $items = new BehaviorSubject<any[]>(undefined);
  $loaded = new BehaviorSubject<boolean>(false);

  slidesOptions: {
    speed: 100; // FIXME: seems it's not working
  };

  @Input() logPrefix = '[mat-swipe-field]';

  @Input() formControl: FormControl;

  @Input() formControlName: string;

  @Input() floatLabel: FloatLabelType;

  @Input() placeholder: string;

  @Input() debug = false;

  @Input() required = false;

  @Input() mobile: boolean;

  @Input() clearable = false;

  @Input() compareWithFn: CompareWithFn | null;

  @Input() displayWith: DisplayFn | null;

  @Input() displayAttributes: string[];

  @Input() appAutofocus: boolean;

  @Input('class') classList: string;

  @Input() set tabindex(value: number) {
    if (this._tabindex !== value) {
      this._tabindex = value;
      setTimeout(() => this.updateTabIndex());
    }
  }

  get tabindex(): number {
    return this._tabindex;
  }

  @Input() set items(value: Observable<any[]> | any[]) {
    // Remove previous subscription on items, (if exits)
    if (this._itemsSubscription) {
      console.warn(`${this.logPrefix} Items received twice !`);
      this._subscription.remove(this._itemsSubscription);
      this._itemsSubscription.unsubscribe();
    }

    if (isObservable<any[]>(value)) {
      this._itemsSubscription = this._subscription.add(
        value.subscribe(v => {
          this.loadItems(v);
        })
      );
    } else {
      if (value !== this.$items.getValue()) {
        this.loadItems(value as any[]);
      }
    }
  }

  get items(): Observable<any[]> | any[] {
    return this.$items.getValue();
  }

  get itemCount(): number {
    return (this.$items.getValue() || []).length;
  }

  @Output('click') onClick = new EventEmitter<MouseEvent>();

  @Output('blur') onBlur = new EventEmitter<FocusEvent>();

  @Output('focus') onFocus = new EventEmitter<FocusEvent>();

  @ViewChild('fakeInput') fakeInput: ElementRef;

  @ViewChild('slides', {static: true}) slides: IonSlides;

  @ViewChild('prevButton') prevButton: MatButton;
  @ViewChild('nextButton') nextButton: MatButton;

  get value(): any {
    return this._value;
  }

  get disabled(): any {
    return this.formControl.disabled;
  }

  get enabled(): any {
    return this.formControl.enabled;
  }

  constructor(
    protected cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
  }

  ngOnInit() {
    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-swipe-field>.');

    // Default values
    this.displayAttributes = this.displayAttributes || ['label', 'name'];
    this.displayWith = this.displayWith || ((obj) => obj && joinPropertiesPath(obj, this.displayAttributes));
    this.compareWithFn = this.compareWithFn || ((o1: any, o2: any) => o1 && o2 && o1.id === o2.id);

    this.mobile = toBoolean(this.mobile, false);
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
    this._value = undefined;
    this.$items.complete();
  }

  _onFocusFakeInput(event: FocusEvent) {
    event.preventDefault();

    // Hide the fake input
    if (this.fakeInput) {
      this.fakeInput.nativeElement.classList.add('hidden');
      this.fakeInput.nativeElement.tabIndex = -1;
    }

    // Focus on first button
    this.focus();
  }

  focus() {
    // show slides component
    this.showSlides = true;

    setTimeout(() => {
      if (this.prevButton) {
        this.prevButton.focus();
      }
      this.updateTabIndex();
    });

    if (isNil(this._value)) {
      // Slide to first and affect value
      this.slideTo(0);
      this.slideChanged();
    }

    this.markForCheck();
  }

  /**
   * This is a special case, because, this component has a temporary component displayed before the first focus event
   */
  private updateTabIndex() {
    if (isNil(this._tabindex) || this._tabindex === -1) return;

    if (this.fakeInput) {
      if (this.showSlides) {
        this.fakeInput.nativeElement.classList.add('hidden');
        this.fakeInput.nativeElement.tabIndex = -1;
      } else {
        this.fakeInput.nativeElement.classList.remove('hidden');
        this.fakeInput.nativeElement.tabIndex = this._tabindex;
      }
    }
    if (this.prevButton && this.nextButton) {
      this.prevButton._elementRef.nativeElement.tabIndex = this.showSlides ? this._tabindex : -1;
      this.nextButton._elementRef.nativeElement.tabIndex = this.showSlides ? this._tabindex + 1 : -1;
    }
    this.markForCheck();
  }

  writeValue(value: any): void {
    if (this._writing) return;

    this._writing = true;
    if (!this.compareWithFn(value, this._value)) {
      this._value = value;
      this.showSlides = isNotNil(this._value);
      this.updateSlides();
      setTimeout(() => this.updateTabIndex());
    }
    this._writing = false;

    this.markForCheck();
  }

  clearValue(event: UIEvent) {
    event.stopPropagation();
    this._writing = true;
    if (this.debug) console.debug(`${this.logPrefix} clear value`);
    this._value = undefined;
    this.formControl.patchValue(null, {emitEvent: false});
    this.showSlides = false;
    setTimeout(() => {
      this.updateTabIndex();
      this.slideTo(0);
      setTimeout(() => {
        this._writing = false;
      }, 100);
    });
    this._onChangeCallback(null);
    this.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.slides.lockSwipes(isDisabled).then(() => this.updateButtons());
    this.cd.markForCheck();
  }

  selectInputContent = selectInputContent;

  previous() {
    this.slides.slidePrev();
  }

  next() {
    this.slides.slideNext();
  }

  reachStart(reached: boolean) {
    this.previousDisabled = reached;
  }

  reachEnd(reached: boolean) {
    this.nextDisabled = reached;
  }

  slidesLoaded() {
    this.$loaded.next(true);
  }

  slideChanged() {
    this.slides.getActiveIndex()
      .then(activeIndex => {
        if (this._writing) return;
        this._writing = true;
        const value = (this.$items.getValue() || [])[activeIndex] || undefined;
        if (this.debug) console.debug(`${this.logPrefix} slide changed ActiveIndex:${activeIndex}, new value:${value}`);
        this.formControl.patchValue(value, {emitEvent: false});
        this._writing = false;
        this.checkIfTouched();
        this._onChangeCallback(value);
      });
  }

  /* -- protected method -- */

  private loadItems(items: any[]) {
    this.$items.next(items);
    if (this.$loaded.getValue() === true) {
      this.slides.update();
    }
  }

  private checkIfTouched() {
    if (this.formControl.touched) {
      this.markForCheck();
      this._onTouchedCallback();
    }
  }

  private markForCheck() {
    this.cd.markForCheck();
  }

  private updateSlides() {
    if (this.showSlides) {
      const itemIndex = (this.$items.getValue() || []).findIndex(value => this.compareWithFn(value, this._value));
      if (itemIndex >= 0) {
        this.slideTo(itemIndex);
      } else {
        console.warn(`${this.logPrefix} Item not found`, this._value);
        this.slideTo(0);
      }
    }
  }

  private slideTo(index: number) {
    this.slides.slideTo(index, 0, false).then(() =>
      this.slides.update().then(() =>
        this.updateButtons()
      )
    );
  }

  private async updateButtons() {
    const activeIndex = await this.slides.getActiveIndex();
    if (this.debug) console.debug(`${this.logPrefix} update buttons ActiveIndex:${activeIndex}`);
    this.previousDisabled = activeIndex === 0 || this.disabled;
    this.nextDisabled = activeIndex === this.itemCount - 1 || this.disabled;
  }


  // not used ...
  async getSlides(): Promise<IonSlides> {
    await this.ready();
    return this.slides;
  }

  async ready(): Promise<void> {
    // Wait pmfms load, and controls load
    if (this.$loaded.getValue() === false) {
      if (this.debug) console.debug(`${this.logPrefix} waiting slides to be ready...`);
      await firstNotNilPromise(this.$loaded
        .pipe(
          filter((loaded) => loaded === true)
        ));
    }
  }

}
