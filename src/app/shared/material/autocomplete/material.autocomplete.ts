import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, forwardRef, HostBinding, Input, OnDestroy, OnInit, Optional, Output, Provider, ViewChild} from '@angular/core';
import {ControlValueAccessor, FormControl, FormGroupDirective, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BehaviorSubject, isObservable, merge, Observable, of, Subject, Subscription, timer} from 'rxjs';
import {debounceTime, distinctUntilChanged, filter, map, mergeMap, mergeScan, startWith, switchMap, takeUntil, takeWhile, tap, throttleTime} from 'rxjs/operators';
import {FetchMoreFn, LoadResult, SuggestFn, SuggestService} from '../../services/entity-service.class';
import {changeCaseToUnderscore, getPropertyByPath, isNil, isNilOrBlank, isNotNil, isNotNilOrBlank, joinPropertiesPath, sleep, suggestFromArray, toBoolean, toNumber} from '../../functions';
import {focusInput, InputElement, selectInputContent} from '../../inputs';
import {firstNotNilPromise} from '../../observables';
import {CompareWithFn, DisplayFn} from '../../form/field.model';
import {FloatLabelType} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';
import {MatAutocomplete} from '@angular/material/autocomplete';
import {fromScrollEndEvent} from '../../events';
import {start} from 'repl';


export declare interface MatAutocompleteFieldConfig<T = any, F = any> {
  attributes: string[];
  suggestFn?: (value: any, options?: any) => Promise<T[] | LoadResult<T>>;
  filter?: Partial<F>;
  items?: Observable<T[]> | T[];
  columnSizes?: (number|'auto'|undefined)[];
  columnNames?: (string|undefined)[];
  displayWith?: DisplayFn;
  compareWith?: CompareWithFn;
  showAllOnFocus?: boolean;
  showPanelOnFocus?: boolean;
  class?: string;
  mobile?: boolean;
}

export declare interface MatAutocompleteFieldAddOptions<T = any, F = any> extends Partial<MatAutocompleteFieldConfig<T, F>> {
  service?: SuggestService<T, F>;
}

export class MatAutocompleteConfigHolder {
  fields: {
    [key: string]: MatAutocompleteFieldConfig;
  } = {};

  getUserAttributes: (fieldName: string, defaultAttributes?: string[]) => string[];

  constructor(private options?: {
    getUserAttributes: (fieldName: string, defaultAttributes?: string[]) => string[];
  }) {
    // Store the function from options (e.g. get from user settings)
    // or create a default function
    this.getUserAttributes = options && options.getUserAttributes ||
      function(fieldName, defaultAttributes): string[] {
        return defaultAttributes || ['label', 'name'];
      };
  }

  add<T = any, F = any>(fieldName: string, options?: MatAutocompleteFieldAddOptions<T, F>): MatAutocompleteFieldConfig<T, F> {
    if (!fieldName) {
      throw new Error('Unable to add config, with name: ' + (fieldName || 'undefined'));
    }
    options = options || <MatAutocompleteFieldAddOptions>{};
    const suggestFn: SuggestFn<T, F> = options.suggestFn
      || (options.service && ((v, f) => options.service.suggest(v, f)))
      || undefined;
    const attributes = this.getUserAttributes(fieldName, options.attributes) || ['label', 'name'];
    const attributesOrFn = attributes.map((a, index) => typeof a === 'function' && options.attributes[index] || a);
    const filter: Partial<F> = {
      searchAttribute: attributes.length === 1 ? attributes[0] : undefined,
      searchAttributes: attributes.length > 1 ? attributes : undefined,
      ...options.filter
    };
    const displayWith = options.displayWith || ((obj) => obj && joinPropertiesPath(obj, attributesOrFn));
    const compareWith = options.compareWith || ((o1: any, o2: any) => o1 && o2 && o1.id === o2.id);

    const config: MatAutocompleteFieldConfig = {
      attributes: attributesOrFn,
      suggestFn,
      items: options.items,
      filter,
      displayWith,
      compareWith,
      columnSizes: options.columnSizes,
      columnNames: options.columnNames,
      showAllOnFocus: options.showAllOnFocus,
      showPanelOnFocus: options.showPanelOnFocus,
      mobile: options.mobile,
      class: options.class
    };

    this.fields[fieldName] = config;
    return config;
  }

  get<T = any>(fieldName: string): MatAutocompleteFieldConfig<T> {
    if (!fieldName) {
      throw new Error('Unable to add config, with name: ' + (fieldName || 'undefined'));
    }
    return this.fields[fieldName] || this.add(fieldName) as MatAutocompleteFieldConfig<T>;
  }
}

const DEFAULT_VALUE_ACCESSOR: Provider = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MatAutocompleteField),
  multi: true
};
const noop = () => {};

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mat-autocomplete-field',
  styleUrls: ['./material.autocomplete.scss'],
  templateUrl: './material.autocomplete.html',
  providers: [DEFAULT_VALUE_ACCESSOR],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatAutocompleteField implements OnInit, InputElement, OnDestroy, ControlValueAccessor  {

  private _onChangeCallback: (_: any) => void = noop;
  private _onTouchedCallback: () => void = noop;
  private _onFetchMoreCallback: FetchMoreFn<LoadResult<any>>;
  private _implicitValue: any;
  private _subscription = new Subscription();
  private _itemsSubscription: Subscription;
  private _openedSubscription: Subscription;
  private _filter$ = new BehaviorSubject<any>(undefined);
  private _itemCount: number;
  private _reload$ = new Subject<any>();

  _tabindex: number;
  matSelectItems$: Observable<any[]>;
  inputItems$ = new BehaviorSubject<any[]>(undefined);
  filteredItems$ = new BehaviorSubject<any[]>(undefined);
  searchable: boolean;
  displayValue = '';

  _fetchMore$ = new EventEmitter<Event>();
  onDropButtonClick = new EventEmitter<UIEvent>(true);

  get itemCount(): number {
    return this._itemCount;
  }

  get canFetchMore(): boolean {
    return this._onFetchMoreCallback && true;
  }

  @Input() compareWith: (o1: any, o2: any) => boolean;
  @Input() logPrefix = '[mat-autocomplete] ';
  @Input() formControl: FormControl;
  @Input() formControlName: string = null;
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
  @Input() displayColumnSizes: (number|'auto'|undefined)[];
  @Input() displayColumnNames: string[];
  @Input() showAllOnFocus: boolean;
  @Input() showPanelOnFocus: boolean;
  @Input() appAutofocus: boolean;
  @Input() config: MatAutocompleteFieldConfig;
  @Input() i18nPrefix = 'REFERENTIAL.';
  @Input() noResultMessage = 'COMMON.NO_RESULT';
  @Input('class') classList: string;
  @Input() panelWidth: string;
  @Input() matAutocompletePosition: 'auto' | 'above' | 'below' = 'auto';
  @Input() multiple = false;

  @Input() fetchMoreThreshold: string = "15%";

  @HostBinding('@.disabled')
  animationsDisabled = true;

  @Input() set filter(value: any) {
    if (value !== this._filter$.value) {
      // DEBUG
      //console.debug(this.logPrefix + " Setting filter:", value);
      this._filter$.next(value);
    }
  }

  get filter(): any {
    return this._filter$.value;
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
      console.warn(this.logPrefix + ' Items received twice !');
      this._subscription.remove(this._itemsSubscription);
      this._itemsSubscription.unsubscribe();
    }

    if (isObservable<any[]>(value)) {
      this._itemsSubscription = this._subscription.add(
        value.subscribe(v => {
          //console.warn(this.logPrefix + " Received items: ", v);
          this.inputItems$.next(v);
        })
      );
    }
    else {
      if (value !== this.inputItems$.getValue()) {
        this.inputItems$.next(value as any[]);
      }
    }
  }

  get items(): Observable<any[]> | any[] {
    return this.inputItems$;
  }

  @Output('click') onClick = new EventEmitter<MouseEvent>();
  @Output('blur') onBlur = new EventEmitter<FocusEvent>();
  @Output('focus') onFocus = new EventEmitter<FocusEvent>();

  @ViewChild('matSelect') matSelect: MatSelect;
  @ViewChild('matInputText') matInputText: ElementRef;
  @ViewChild('autoComplete') matAutoComplete: MatAutocomplete;


  get value(): any {
    return this.formControl.value;
  }

  get disabled(): any {
    return this.readonly || this.formControl.disabled;
  }

  get enabled(): any {
    return !this.readonly && this.formControl.enabled;
  }

  constructor(
    protected cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
  }

  ngOnInit() {
    this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;
    if (!this.formControl) throw new Error('Missing mandatory attribute \'formControl\' or \'formControlName\' in <mat-autocomplete-field>.');

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
      this.mobile = toBoolean(this.mobile, this.config.mobile);
      this.showAllOnFocus = toBoolean(this.showAllOnFocus, toBoolean(this.config.showAllOnFocus, true));
      this.showPanelOnFocus = toBoolean(this.showPanelOnFocus, toBoolean(this.config.showPanelOnFocus, true));
      this.classList = this.classList || this.config.class;
    }

    // Default values
    this.displayAttributes = this.displayAttributes || (this.filter && this.filter.attributes) || ['label', 'name'];
    this.displayWith = this.displayWith || ((obj) => obj && joinPropertiesPath(obj, this.displayAttributes));
    this.displayColumnSizes = this.displayColumnSizes
      // if only column: auto size
      || (this.displayAttributes.length === 1 && [undefined])
      || this.displayAttributes.map(attr =>
        // If label, set col size = 2
        (attr && attr.endsWith('label')) ? 2 :
          // If rankOrder => col size = 1
          ((attr && attr.endsWith('rankOrder')) ? 1
            // Else => auto size
            : undefined));
    this.displayColumnNames = this.displayAttributes.map((attr, index) => this.displayColumnNames && this.displayColumnNames[index] ||
        (this.i18nPrefix + changeCaseToUnderscore(attr).toUpperCase()));
    this.mobile = toBoolean(this.mobile, false);
    this.searchable = !this.mobile && !this.multiple;
    // Default comparator (only need when using mat-select)
    if (!this.searchable && !this.compareWith) this.compareWith = (o1: any, o2: any) => o1 && o2 && o1.id === o2.id;
    this.panelWidth = this.panelWidth || (this.classList
      && (this.classList === 'min-width-medium' && '300px')
      || (this.classList === 'min-width-large' && '400px')
      || (this.classList === 'min-width-xlarge' && '450px')
      || (this.classList === 'mat-autocomplete-panel-full-size' && '100vw'));

    // No suggestFn: filter on the given items
    if (!this.suggestFn) {
      const suggestFromArrayFn: SuggestFn<any, any> = async (value, filter) => {
        // DEBUG
        //console.debug(this.logPrefix + " Calling suggestFromArray with value=", value);

         return suggestFromArray(this.inputItems$.value, value, {
          searchAttributes: this.displayAttributes,
          ...filter
        })
      };
      // Wait (once) that items are loaded, then call suggest from array fn
      this.suggestFn = async (value, filter) => {
        if (isNil(this.inputItems$.value)) {
          // DEBUG
          //console.debug(this.logPrefix + " Waiting items to be set...");

          await firstNotNilPromise(this.inputItems$);

          // DEBUG
          //console.debug(this.logPrefix + " Received items:", this.inputItems$.value);
        }
        this.suggestFn = suggestFromArrayFn;
        return this.suggestFn(value, filter); // Loop
      };
    }
    else if (!this.searchable) {
      // Manually fill input items, from the given suggest function
      this._subscription.add(
        this._filter$.pipe(
          startWith<any, any>(this.filter),
          debounceTime(250),
          takeWhile((_) => !this.searchable), // Close subscription, when enabling search (no more mat-select)
          switchMap((filter) => this.suggest('*', filter) )
        )
        .subscribe(items => this.inputItems$.next(items))
      );
    }

    const filteredItemsChanges = merge(
      merge(
        // Focus or click => Load all
        merge(this.onFocus, this.onClick)
          .pipe(
            filter(_ => this.searchable && this.enabled),
            map(_ => this.showAllOnFocus ? '*' : this.formControl.value)
          ),
        this.onDropButtonClick
          .pipe(
            filter(event => this.searchable && (!event || !event.defaultPrevented) && this.formControl.enabled),
            map(_ =>  this.showAllOnFocus ? '*' : this.formControl.value)
          ),
        this.formControl.valueChanges
          .pipe(
            startWith<any, any>(this.formControl.value),
            filter(_ => this.searchable),
            // Compute display value
            tap(value => {
              const displayValue = this.displayWith(value) || '';
              if (this.displayValue !== displayValue) {
                this.displayValue = displayValue;
                this.cd.markForCheck();
              }
            }),
            filter(value => isNotNilOrBlank(value)),
            //tap((value) => console.debug(this.logPrefix + " valueChanges:", value)),
            debounceTime(this.debounceTime)
          ),
        merge(this.inputItems$, this._filter$)
          .pipe(
            map(_ => this.searchable && this.formControl.value)
          ),
      ).pipe(distinctUntilChanged()),

      // Not distinguish changes
      this._reload$
    )
    .pipe(
      // DEBUG
      //tap(value => console.debug(this.logPrefix + ' Received update event: ', value)),

      // Suggest values
      mergeMap(value => this.suggest(value, this.filter)),
      // DEBUG
      //tap(items => console.debug(this.logPrefix + ' Received from suggest: ', items)),

      // Store implicit value (will use it onBlur if not other value selected)
      tap(items => this.updateImplicitValue(items))
    );

    // Fetch more events
    const fetchMoreItemsChanges = this._fetchMore$
      .pipe(
        tap(event => event?.preventDefault()),
        filter(() => this.canFetchMore),
        mergeMap(() => this.fetchMore()),
        // DEBUG
        //tap(moreItems => console.debug(this.logPrefix + ' Received from fetch More: ', moreItems)),
        // Concat to existing items
        map(moreItems => (this.filteredItems$.value || []).concat(moreItems))
      );

    // Update filtered items
    this._subscription.add(
      merge(
        this.inputItems$,

        // Update items events
        filteredItemsChanges,

        // Fetch more events
        fetchMoreItemsChanges
      )
      .subscribe(items => {
        // Make sure control value is inside (mat-select)
        if (items && !this.searchable){
          const value = this.formControl.value;
          if (isNotNil(value) && typeof value === 'object' && items.findIndex(item => this.compareWith(item, value)) === -1) {
            // If form value is missing: add it to the list
            items = items.concat(value);
          }
        }
        // Emit items
        this.filteredItems$.next(items)
      }));

    // Applying implicit value, on blur
    this._subscription.add(
      this.onBlur
        .pipe(
          // Skip if no implicit value, or has already a value
          filter(_ => this.searchable),
          map(_ => this.formControl.value)
        )
        .subscribe( value => {
          // When leave component without object, use implicit value if :
          // - an explicit value
          // - field is not empty (user fill something)
          // - OR field empty but is required
          if (this._implicitValue && ((this.required && isNilOrBlank(value)) || (isNotNilOrBlank(value) && typeof value !== 'object'))) {
            this.writeValue(this._implicitValue);
            this.formControl.markAsPending({emitEvent: false, onlySelf: true});
            this.formControl.updateValueAndValidity({emitEvent: false, onlySelf: true});
            this.checkIfTouched();
          }
          else if (isNilOrBlank(value)) {
            this.writeValue(null);
            this.formControl.markAsPending({emitEvent: false, onlySelf: true});
            this.formControl.updateValueAndValidity({emitEvent: false, onlySelf: true});
            this.checkIfTouched();
          }
          this._implicitValue = null; // reset the implicit value
        }));
  }

  ngOnDestroy(): void {

    this._subscription.unsubscribe();
    this.inputItems$.complete();
    this.filteredItems$.complete();
    this._reload$.complete();
    this._filter$.complete();

    this.onDropButtonClick.complete();
    this.onClick.complete();
    this.onBlur.complete();
    this.onFocus.complete();

    this._implicitValue = undefined;
    this.formControl = null;
    this.displayWith = null;
    this.compareWith = null;
    this.suggestFn = null;
    this.filteredItems$ = null;
    this.matSelectItems$ = null;
    this.config = null;
    this.classList = null;

    this._onChangeCallback = null;
    this._onTouchedCallback = null;
    this._onFetchMoreCallback = null

    // Destroy the 'autocomplete' instance, to avoid memory leak
    this.matAutoComplete?.ngOnDestroy();
  }

  /**
   * Allow to reload content. Useful when filter has been changed but not detected
   */
  reloadItems(value?: any) {
    // Force a refresh
    this._reload$.next(value || '*');
  }

  writeValue(value: any): void {
    // DEBUG
    // console.debug(this.logPrefix + " Writing value: ", value);

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

  selectInputContent = selectInputContent;
  getPropertyByPath = getPropertyByPath;

  focus() {
    if (this.searchable) {
      focusInput(this.matInputText);
    }
    else {
      this.matSelect?.focus();
    }
  }

  filterInputTextFocusEvent(event: FocusEvent) {
    if (!event || event.defaultPrevented) return;

    // Ignore event from mat-option
    if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.tagName === 'MAT-OPTION') {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      event.returnValue = false;
      //DEBUG console.debug(this.logPrefix + " Cancelling focus event");
      return false;
    }

    const hasContent = selectInputContent(event);
    if (!hasContent || (this.showPanelOnFocus && this.showAllOnFocus) ) {
      //DEBUG console.debug(this.logPrefix + " Emit focus event");
      this.onFocus.emit(event);
      return true;
    }
    return false;
  }

  filterMatSelectFocusEvent(event: FocusEvent) {
    if (!event || event.defaultPrevented) return;
    // DEBUG
    // console.debug(this.logPrefix + " Received <mat-select> focus event", event);
    this.onFocus.emit(event);
  }

  filterMatSelectBlurEvent(event: FocusEvent) {
    if (!event || event.defaultPrevented) return;

    // DEBUG
    // console.debug(this.logPrefix + " Received <mat-select> blur event", event);

    // Ignore event from mat-option
    if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.tagName === 'MAT-OPTION') {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      event.returnValue = false;
      // DEBUG
      // console.debug(this.logPrefix + " Cancelling <mat-select> blur event");
      return false;
    }

    this.onBlur.emit(event);
    return true;
  }

  toggleSearch(event: UIEvent) {
    const searchable = !this.searchable;
    if (searchable && this.searchable && this.matInputText) {
      this.focus();
    }
    else {
      this.searchable = searchable;
      if (searchable) {
        this.appAutofocus = true;
        this.showPanelOnFocus = false;
      }
      this.markForCheck();
    }
  }

  clearValue(event: UIEvent) {
    this.writeValue(null);
    event.stopPropagation();
  }

  _listenAutocompleteScroll(threshold?: string) {

    // DEBUG
    //console.debug(this.logPrefix + ' Init autocomplete scroll listener');

    if (!this.matAutoComplete) return;
    if (this._openedSubscription) {
      this._subscription.remove(this._openedSubscription);
      this._openedSubscription.unsubscribe();
    }
    this._openedSubscription = merge(
      this.matAutoComplete.opened,
      timer(0) // Force first call, because sometime first opened event is skipped
    )
      .pipe(
        // Wait 200ms, then to get the panel element
        debounceTime(200),
        mergeMap(() => this.getAutocompletePanel()),
        filter(isNotNil),
        // DEBUG
        //tap(() => console.debug(this.logPrefix + ' Found autocomplete panel [OK]')),

        // Listen end scroll event, on panel
        switchMap(ele => fromScrollEndEvent(ele, threshold)
          .pipe(
            // Stop watch scroll, when panel closed
            takeUntil(this.matAutoComplete.closed)
          )
        ),
      )
      // Trigger fetch more event
      .subscribe(() => this._fetchMore$.emit())

    // Register subscription
    this._subscription.add(this._openedSubscription);
  }

  _fetchMoreClick(event?: Event) {

    this._fetchMore$.emit(event);
  }

  /* -- private method -- */

  private async suggest(value: any, filter?: any): Promise<any[]> {
    // Call suggestion function
    let res = await this.suggestFn(value, filter);

    // DEBUG
    //console.debug(this.logPrefix + " Filtered items by suggestFn:", value, res);
    if (!res) {
      this._itemCount = 0;
      this._onFetchMoreCallback = undefined;
    }
    else if (Array.isArray(res)) {
      this._itemCount = (res as any[]).length || 0;
      this._onFetchMoreCallback = undefined;
    }
    else {
      const {data, total, fetchMore} = res as LoadResult<any>;
      this._itemCount = toNumber(total, data && data.length || 0) ;
      this._onFetchMoreCallback = data && data.length < total && fetchMore;
      res = data;
    }
    return res as any[];
  }

  private async fetchMore(): Promise<any[]> {
    if (!this._onFetchMoreCallback) return [];

    // Save then remove fetch function (to avoid multi-call)
    const fetchMoreFn = this._onFetchMoreCallback;
    this._onFetchMoreCallback = undefined;

    const {data, total, fetchMore} = await fetchMoreFn();
    this._onFetchMoreCallback = data && data.length < total && fetchMore;
    return data;
  }

  private updateImplicitValue(items: any[]) {
    if (this.searchable) {
      // Store implicit value (will use it onBlur if not other value selected)
      if (items && items.length === 1) {
        this._implicitValue = items[0];
        //this.formControl.setErrors(null);
      } else {
        this._implicitValue = undefined;
      }
    }
  }

  private checkIfTouched() {
    if (this.formControl.touched) {
      this.cd.markForCheck();
      this._onTouchedCallback();
    }
  }

  private async getAutocompletePanel(): Promise<HTMLElement> {
    let ele;
    while (!ele) {
      ele = this.matAutoComplete?.options.last?._getHostElement().parentElement;
      if (!ele) {
        // DEBUG
        console.warn(this.logPrefix + ' Waiting autocomplete div...');
        await sleep(250);
      }
    }
    return ele;
  }

  private markForCheck() {
    this.cd.markForCheck();
  }
}
