import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Injector,
  Input,
  OnInit,
  Optional,
  Output
} from '@angular/core';
import {AbstractControl, FormArray, FormBuilder, FormGroup, FormGroupDirective, Validators} from '@angular/forms';
import {referentialToString} from '../services/model/referential.model';
import {isNil} from '../../shared/functions';
import {DateAdapter} from '@angular/material/core';
import {Moment} from 'moment';
import {LocalSettingsService} from '../services/local-settings.service';
import {AppForm} from './form.class';
import {AppFormUtils, FormArrayHelper, FormArrayHelperOptions} from './form.utils';
import {SelectionModel} from '@angular/cdk/collections';
import {Observable} from 'rxjs';
import {Color} from '@ionic/core';

export declare interface ItemButton<T = any> {
  title?: string;
  click: (event: UIEvent, item: T, index: number) => void;
  icon: string;
  color?: Color;
  disabled?: Observable<boolean>;
}

export declare type AppListFormOptions<T> = FormArrayHelperOptions & {
  allowMultipleSelection?: boolean;
  buttons?: ItemButton<T>[];
};

@Component({
  selector: 'app-list-form',
  templateUrl: 'list.form.html',
  styleUrls: ['./list.form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppListForm<T = any> extends AppForm<T[]> implements OnInit {
  loading = true;
  helper: FormArrayHelper<T>;
  selection = new SelectionModel<T>(true, []);

  @Input() formArrayName: string;
  @Input() formArray: FormArray;
  @Input() options: AppListFormOptions<T>;

  @Input('displayWith') displayWithFn: (item: any) => string = referentialToString;
  @Input('equals') equalsFn: (v1: T, v2: T) => boolean;

  @Output() onNewItem = new EventEmitter<UIEvent>();
  @Output() selectionChanges = new EventEmitter<T[]>(true);

  set value(data: T[]) {
    this.setValue(data);
  }

  get value(): T[] {
    return this.formArray.value as T[];
  }

  get itemControls(): FormGroup[] {
    return this.formArray && this.formArray.controls as FormGroup[];
  }

  get length(): number {
    return this.helper ? this.helper.size() : 0;
  }

  get empty(): boolean {
    return this.length === 0;
  }

  get touched(): boolean {
    return this.formArray && (this.formArray.touched || (this.formArray.controls || []).findIndex(c => c.touched) !== -1);
  }

  get untouched(): boolean {
    return !this.formArray || this.formArray.untouched || (this.formArray.controls || []).findIndex(c => c.touched) === -1;
  }

  get dirty(): boolean {
    return this.formArray && this.formArray.dirty;
  }

  get invalid(): boolean {
    return !this.formArray || this.formArray.invalid;
  }

  get valid(): boolean {
    return this.formArray && this.formArray.valid;
  }

  get pending(): boolean {
    return !this.formArray || this.formArray.pending;
  }

  markAsTouched(opts?: { onlySelf?: boolean; emitEvent?: boolean }) {
    AppFormUtils.markAsTouched(this.formArray, opts);
    this.markForCheck();
  }
  constructor(
    protected injector: Injector,
    protected formBuilder: FormBuilder,
    protected dateAdapter: DateAdapter<Moment>,
    protected settings: LocalSettingsService,
    protected cd: ChangeDetectorRef,
    @Optional() private formGroupDir: FormGroupDirective
  ) {
    super(dateAdapter,
      null,
      settings);

    //this.debug = !environment.production;
  }

  ngOnInit() {

    this.options = {
      allowEmptyArray: true,
      allowMultipleSelection: true,
      buttons: [],
      ...this.options};

    // Retrieve the form
    const form = (this.formArray && this.formArray.parent as FormGroup || this.formGroupDir && this.formGroupDir.form || this.formBuilder.group({}));
    this.setForm(form);

    this.formArray = this.formArray || this.formArrayName && form.get(this.formArrayName) as FormArray;
    this.formArrayName = this.formArrayName || this.formArray && Object.keys(form.controls).find(key => form.get(key) === this.formArray) || 'properties';
    if (!this.formArray) {
      console.warn(`Missing array control '${this.formArrayName}'. Will create it!`);
      this.formArray = this.formBuilder.array([]);
      this.form.addControl(this.formArrayName, this.formArray);
    }

    this.equalsFn = this.equalsFn || ((v1: any, v2: any) => (isNil(v1) && isNil(v2)) || v1 === v2);
    this.helper = new FormArrayHelper<T>(
      this.formArray,
      (value) => this.createControl(value),
      this.equalsFn,
      (value) => isNil(value),
      this.options
    );

    super.ngOnInit();
  }

  ngOnDestroy() {
    super.ngOnDestroy();

    this.onNewItem.complete();
    this.onNewItem.unsubscribe();
    this.selectionChanges.complete();
    this.selectionChanges.unsubscribe();
  }

  setValue(data: T[] | any) {
    data = data || [];

    if (this.helper) {
      this.helper.resize(data.length);
      this.helper.formArray.patchValue(data, {emitEvent: false});
    }

    this.selection.clear();
    this.markAsPristine();
    this.loading = false;
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    return this.selection.selected.length === this.length;
  }

  async masterToggle(opts?: {emitEvent?: boolean}) {
    if (this.loading) return;
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      const items = this.value;
      items.forEach(item => this.selection.select(item));
    }

    if (!opts || opts.emitEvent !== false) {
      this.selectionChanges.emit(this.selection.selected);
    }
  }

  async onItemClick(event: MouseEvent, item: T, opts?: {emitEvent?: boolean}) {

    if (!item || event.defaultPrevented || !this.selectionChanges.observers.length) return;

    // Multiple selection (if ctrl+click)
    if (event.ctrlKey && this.options.allowMultipleSelection) {
      this.selection.toggle(item);
    }
    else {
      // Unselect all

      // Select the item (or reselect)
      if (!this.selection.isSelected(item) || (this.options.allowMultipleSelection && this.selection.selected.length > 1)) {
        this.selection.clear();
        this.selection.select(item);
      }
      // Unselect all
      else {
        this.selection.clear();
      }
    }

    if (!opts || opts.emitEvent !== false) {
      this.selectionChanges.emit(this.selection.selected);
    }
  }

  async onItemButtonClick(button: ItemButton, event: MouseEvent, item: T, index: number) {
    if (button.click) button.click(event, item, index);
    await this.onItemClick(event, item);
  }

  hasSelection(): boolean {
    return this.selection.hasValue();
  }

  onNewClick(event: UIEvent) {
    this.onNewItem.emit(event);
  }

  add(value: T, opts?: {emitEvent?: boolean}) {
    const done = this.helper.add(value, {emitEvent: true});
    if (done) {
      if (!this.options.allowMultipleSelection) {
        this.selection.clear();
      }
      this.selection.toggle(value);
      this.markForCheck();

      if (!opts || opts.emitEvent !== false) {
        this.selectionChanges.emit(this.selection.selected);
      }
    }
  }

  removeAt(index: number) {
    const item = this.helper.at(index).value;
    if (this.selection.isSelected(item)) {
      this.selection.deselect(item);
    }
    this.helper.removeAt(index);
  }

  displayWith(value: T): string {
    return this.displayWithFn ? this.displayWithFn(value) : (value as any);
  }


  /* -- protected methods -- */

  protected createControl(data?: any): AbstractControl {
    return this.formBuilder.control(data || null, Validators.required);
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }

}

