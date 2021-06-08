import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Optional, Output, ViewChild} from '@angular/core';
import {ControlValueAccessor, FormControl, FormGroupDirective, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BehaviorSubject, isObservable, merge, Observable, Subscription} from 'rxjs';
import {FloatLabelType} from '@angular/material/form-field';
import {debounceTime, distinctUntilChanged, filter, map, startWith, switchMap, tap} from 'rxjs/operators';
import {MatAutocompleteSelectedEvent, MatAutocompleteTrigger} from '@angular/material/autocomplete';
import {focusInput, InputElement, selectInputContent} from '../../inputs';
import {LoadResult, SuggestFn} from '../../services/entity-service.class';
import {DisplayFn} from '../../form/field.model';
import {MatAutocompleteFieldConfig} from '../autocomplete/material.autocomplete';
import {changeCaseToUnderscore, getPropertyByPath, isNil, isNotNil, isNotNilString, joinPropertiesPath, suggestFromArray, toBoolean, toNumber} from '../../functions';
import {firstNotNilPromise} from '../../observables';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mat-chips-field',
  templateUrl: './material.chips.html',
  styleUrls: ['./material.chips.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => MatChipsField)
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatChipsField implements InputElement, ControlValueAccessor, OnInit, OnDestroy {

  private _onChangeCallback = (_: any) => {};
  private _onTouchedCallback = () => {};

  @Input() compareWith: (o1: any, o2: any) => boolean;
  @Input() logPrefix = '[mat-chips] ';
  @Input() formControl: FormControl;
  @Input() formControlName: string;
  @Input() floatLabel: FloatLabelType;
  @Input() placeholder: string;
  @Input() suggestFn: SuggestFn<any, any>;
  @Input() required = false;
  @Input() mobile: boolean;
  @Input() readonly = false;
  @Input() clearable = false;
  @Input() debounceTime = 250;
  @Input() displayWith: DisplayFn | null;
  @Input() displayAttributes: string[];
  @Input() displayColumnSizes: (number | 'auto' | undefined)[];
  @Input() displayColumnNames: string[];
  @Input() showAllOnFocus: boolean;
  @Input() showPanelOnFocus: boolean;
  @Input() appAutofocus: boolean;
  @Input() config: MatAutocompleteFieldConfig;
  @Input() i18nPrefix = 'REFERENTIAL.';
  @Input() noResultMessage = 'COMMON.NO_RESULT';
  @Input() class: string;
  @Input() debug = false;

  @Output() clicked = new EventEmitter<MouseEvent>();
  @Output() blurred = new EventEmitter<FocusEvent>();
  @Output() focused = new EventEmitter<FocusEvent>();

  @ViewChild('matInputText') matInputText: ElementRef;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger: MatAutocompleteTrigger;

  _tabindex: number;
  $inputItems = new BehaviorSubject<any[]>(undefined);
  filteredItems$: Observable<any[]>;
  onDropButtonClick = new EventEmitter<UIEvent>(true);
  inputControl = new FormControl();
  getPropertyByPath = getPropertyByPath;

  private _subscription = new Subscription();
  private _itemsSubscription: Subscription;
  private _$filter = new BehaviorSubject<any>(undefined);
  private _itemCount: number;

  constructor(
    protected cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
  }

  get itemCount(): number {
    return this._itemCount;
  }

  @Input() set filter(value: any) {
    if (this.debug) console.debug(this.logPrefix + ' Setting filter:', value);
    if (value !== this._$filter.getValue()) {
      this._$filter.next(value);
    }
  }

  get filter(): any {
    return this._$filter.getValue();
  }


  @Input() set tabindex(value: number) {
    this._tabindex = value;
    this.markForCheck();
  }

  get tabindex(): number {
    return this._tabindex;
  }

  @Input() set items(value: Observable<any[]> | any[]) {
    // Remove previous subscription on items, (if exits)
    if (this._itemsSubscription) {
      console.warn('Items received twice !');
      this._subscription.remove(this._itemsSubscription);
      this._itemsSubscription.unsubscribe();
    }

    if (isObservable<any[]>(value)) {

      this._itemsSubscription = this._subscription.add(
        value.subscribe(v => this.$inputItems.next(v))
      );
    } else {
      if (value !== this.$inputItems.getValue()) {
        this.$inputItems.next(value as any[]);
      }
    }
  }

  get value(): any[] {
    return this.formControl.value || [];
  }

  get disabled(): any {
    return this.readonly || this.formControl.disabled;
  }

  get enabled(): any {
    return !this.readonly && this.formControl.enabled;
  }

  ngOnInit() {
    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-chips-field>.');

    // Configuration from config object
    if (this.config) {
      this.suggestFn = this.suggestFn || this.config.suggestFn;
      if (!this.suggestFn && this.config.items) {
        this.items = this.config.items;
      }
      this.filter = this.filter || this.config.filter;
      this.displayAttributes = this.displayAttributes || this.config.attributes;
      this.displayColumnSizes = this.displayColumnSizes || this.config.columnSizes;
      this.displayColumnNames = this.displayColumnNames || this.config.columnNames;
      this.displayWith = this.displayWith || this.config.displayWith;
      this.compareWith = this.compareWith || this.config.compareWith;
      this.mobile = toBoolean(this.mobile, this.config.mobile);
      this.showAllOnFocus = toBoolean(this.showAllOnFocus, toBoolean(this.config.showAllOnFocus, true));
      this.showPanelOnFocus = toBoolean(this.showPanelOnFocus, toBoolean(this.config.showPanelOnFocus, true));
      this.class = this.class || this.config.class;
    }

    // Default values
    this.displayAttributes = this.displayAttributes || (this.filter && this.filter.attributes) || ['label', 'name'];
    this.displayWith = this.displayWith || ((obj) => obj && joinPropertiesPath(obj, this.displayAttributes));
    this.compareWith = this.compareWith || ((o1, o2) => o1 && o2 && o1.id === o2.id);
    this.displayColumnSizes = this.displayColumnSizes || this.displayAttributes.map(attr => (
      // If label then col size = 2
      attr && attr.endsWith('label')) ? 2 :
      // If rankOrder then col size = 1
      (attr && attr.endsWith('rankOrder') ? 1 :
        // Else, auto size
        undefined));
    this.displayColumnNames = this.displayAttributes.map((attr, index) => this.displayColumnNames && this.displayColumnNames[index] ||
      (this.i18nPrefix + changeCaseToUnderscore(attr).toUpperCase()));
    this.mobile = toBoolean(this.mobile, false);

    // No suggestFn: filter on the given items
    if (!this.suggestFn) {
      const suggestFromArrayFn: SuggestFn<any, any> = async (value, filter) => {
        if (this.debug) console.debug(this.logPrefix + ' Calling suggestFromArray with value=', value);

        const {data, total} = await suggestFromArray(this.$inputItems.getValue(), value, {
          searchAttributes: this.displayAttributes,
          ...filter
        });
        this._itemCount = toNumber(total, data && data.length || 0) ;
        return {data, total};
      };
      // Wait (once) that items are loaded, then call suggest from array fn
      this.suggestFn = async (value, filter) => {
        if (isNil(this.$inputItems.getValue())) {
          if (this.debug) console.debug('[mat-chips] Waiting items to be set...');

          await firstNotNilPromise(this.$inputItems);

          if (this.debug) console.debug('[mat-chips] Received items:', this.$inputItems.getValue());
        }
        this.suggestFn = suggestFromArrayFn;
        return this.suggest(value, filter); // Loop
      };
    }

    // this.matSelectItems$ = this.$inputItems
    //   .pipe(
    //     filter(isNotNil),
    //     map((items) => {
    //       // Make sure control value is inside
    //       const value = this.inputControl.value;
    //       // If form value is missing: add it to the list
    //       if (isNotNil(value) && typeof value === 'object' && items.findIndex(item => this.compareWith(item, value)) === -1) {
    //         // console.debug(this.logPrefix + " Add form value to items, because missed in items", value);
    //         return items.concat(value);
    //       }
    //       return items;
    //     })
    //   );

    this._subscription.add(
      this.onDropButtonClick
        .pipe(
          filter(event => (!event || !event.defaultPrevented) && this.formControl.enabled),
        )
        .subscribe(() => {
          this.matInputText.nativeElement.focus();
        })
    );

    const updateFilteredItemsEvents$ = merge(
      // Focus or click => Load all
      merge(this.focused, this.clicked)
        .pipe(
          filter(_ => this.enabled),
          map((_) => this.showAllOnFocus ? '*' : this.inputControl.value)
        ),
      this.inputControl.valueChanges
        .pipe(
          startWith<any, any>(this.inputControl.value),
          filter(value => (isNotNil(value) && typeof value === 'object') || (isNotNilString(value) && !value.includes('**'))),
          tap((value) => {
            if (this.debug) console.debug(this.logPrefix + ' valueChanges:', value);
          }),
          debounceTime(this.debounceTime)
        ),
      this.$inputItems
        .pipe(
          map(() => this.formControl.value)
        ),
      this._$filter
        .pipe(
          map(() => this.formControl.value)
        )
    );


    this.filteredItems$ = updateFilteredItemsEvents$
      .pipe(
        distinctUntilChanged(),
        //tap(value => this.debug && console.debug(this.logPrefix + " Received update event: ", value)),
        switchMap( (value) => this.suggest(value, this.filter))
      );
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
    this.$inputItems.complete();
  }

  /**
   * Add item to chips
   *
   * @param event
   */
  add(event: MatAutocompleteSelectedEvent) {

    if (this.debug) console.debug(`${this.logPrefix}select`, event);

    const item = event.option.value;
    this.writeValue([...this.value, item]);
    this.matInputText.nativeElement.value = '';
    this.inputControl.setValue('');

  }

  /**
   * Remove item from chips
   *
   * @param item
   */
  remove(item: any) {
    const index = this.value && this.value.indexOf(item);

    if (index >= 0) {
      const value = this.value.slice();
      value.splice(index, 1);
      this.writeValue(value);
      this.inputControl.setValue('');
    }
  }

  /**
   * Allow to reload content. Useful when filter has been changed but not detected
   */
  reloadItems() {
    this.onDropButtonClick.emit();
  }

  writeValue(value: any[]): void {
    if (this.debug) console.debug(this.logPrefix + ' Writing value: ', value);
    if (value !== this.formControl.value) {
      this.formControl.patchValue(value, {emitEvent: false});
      this._onChangeCallback(value);
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeCallback = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cd.markForCheck();
  }

  focus() {
    focusInput(this.matInputText);
  }

  filterInputTextFocusEvent(event: FocusEvent) {
    if (!event || event.defaultPrevented) return;

    // Ignore event from mat-option
    if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.tagName === 'MAT-OPTION') {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      event.returnValue = false;
      if (this.debug) console.debug(this.logPrefix + ' Cancelling focus event');
      return false;
    }

    const hasContent = selectInputContent(event);
    if (!hasContent || (this.showPanelOnFocus && this.showAllOnFocus)) {
      if (this.debug) console.debug(this.logPrefix + ' Emit focus event');
      this.focused.emit(event);
      return true;
    }
    return false;
  }

  clearValue(event: UIEvent) {
    this.writeValue(null);
    event.stopPropagation();
  }

  /* -- private method -- */

  private async suggest(value: any, filter: any): Promise<any[]> {
    // Call suggestion function
    let res = await this.suggestFn(value, filter);

    // DEBUG
    // console.debug(this.logPrefix + " Filtered items by suggestFn:", value, res);
    if (!res) {
      this._itemCount = 0;
      res = [];
    }
    else if (Array.isArray(res)) {
      res = res as any[];
      this._itemCount = res.length || 0;
    }
    else {
      const {data, total} = res as LoadResult<any>;
      res = data;
      this._itemCount = toNumber(total, data && data.length || 0) ;
    }

    // Filter out existing items
    const filteredData = (res || []).slice().filter(item1 => this.value.findIndex(item2 => this.compareWith(item1, item2)) === -1);

    // Update items count
    this._itemCount = this._itemCount - ((res?.length || 0) - (filteredData?.length || 0));

    if (this.debug) console.debug(this.logPrefix + ' Filtered items by suggestFn:', value, res);

    return res as any[];
  }

  private markForCheck() {
    this.cd.markForCheck();
  }
}
