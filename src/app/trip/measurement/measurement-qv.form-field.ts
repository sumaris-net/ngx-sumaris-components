import { Component, OnInit, Input, EventEmitter, Output, forwardRef, Optional } from '@angular/core';
import { Referential, PmfmStrategy } from "../services/trip.model";
import { Observable, Subject } from 'rxjs';
import { startWith, debounceTime, map } from 'rxjs/operators';
import { referentialToString, EntityUtils } from '../../referential/services/model';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, Validators, FormControl, FormGroupDirective } from '@angular/forms';
import { FloatLabelType } from "@angular/material";


import { SharedValidators } from '../../shared/validator/validators';

@Component({
    selector: 'mat-form-field-measurement-qv',
    templateUrl: './measurement-qv.form-field.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MeasurementQVFormField),
            multi: true
        }
    ]
})
export class MeasurementQVFormField implements OnInit, ControlValueAccessor {

    private _onChangeCallback = (_: any) => { };
    private _onTouchedCallback = () => { };
    private _implicitValue: Referential | any;

    items: Observable<Referential[]>;
    onValueChange = new Subject<any>();

    displayWithFn: (obj: Referential | any) => string;

    @Input() pmfm: PmfmStrategy;

    @Input() disabled: boolean = false

    @Input() formControl: FormControl;

    @Input() formControlName: string;

    @Input() placeholder: string;

    @Input() floatLabel: FloatLabelType = "auto";

    @Input() required: boolean = false;

    @Input() readonly: boolean = false;

    @Input() compact: boolean = false;

    @Input() clearable: boolean = false;

    @Output()
    onBlur: EventEmitter<FocusEvent> = new EventEmitter<FocusEvent>();

    constructor(

        @Optional() private formGroupDir: FormGroupDirective
    ) {

    }

    ngOnInit() {

        this.formControl = this.formControl || this.formControlName && this.formGroupDir && this.formGroupDir.form.get(this.formControlName) as FormControl;


        if (!this.pmfm) throw new Error("Missing mandatory attribute 'pmfm' in <mat-qv-field>.");

        this.formControl.setValidators(this.required || this.pmfm.isMandatory ? [Validators.required, SharedValidators.entity] : SharedValidators.entity);
        if (!this.formControl) throw new Error("Missing mandatory attribute 'formControl' or 'formControlName' in <mat-form-field-measurement-qv>.");

        this.placeholder = this.placeholder || this.computePlaceholder(this.pmfm);

        this.displayWithFn = this.compact ? this.referentialToLabel : referentialToString;

        this.clearable = this.compact ? false : this.clearable;

        this.items = this.onValueChange
            .pipe(
                startWith(this.formControl.value),
                debounceTime(this.compact ? 100 : 250), // Not too long on compact mode
                map(value => {
                    if (EntityUtils.isNotEmpty(value)) return [value];
                    if (!this.pmfm || !this.pmfm.qualitativeValues) return [];
                    value = (typeof value == "string") && (value as string).toUpperCase() || undefined;
                    if (!value) return this.pmfm.qualitativeValues;
                    console.log("Searching QV field on text {" + value + "}...");
                    // Filter by label and name
                    const items: Referential[] = this.pmfm.qualitativeValues.filter((qv) => ((this.startsWithUpperCase(qv.label, value)) || (!this.compact && this.startsWithUpperCase(qv.name, value))));
                    // Store implicit value (will use it onBlur if not other value selected)
                    this._implicitValue = (items.length === 1) ? items[0] : undefined;
                    return items;
                })
            );
    }

    get value(): any {
        return this.formControl.value;
    }

    writeValue(obj: any): void {
        if (obj !== this.formControl.value) {
            this.formControl.setValue(obj);
            this._onChangeCallback(this.value);
        }
    }

    registerOnChange(fn: any): void {
        this._onChangeCallback = fn;
    }
    registerOnTouched(fn: any): void {
        this._onTouchedCallback = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        if (this.disabled != isDisabled) {
            this.disabled = isDisabled;
            if (isDisabled) {
                this.formControl.disable();
            }
            else {
                this.formControl.enable();
            }
        }
    }

    public markAsTouched() {
        if (this.formControl.touched) {
            this._onTouchedCallback();
        }
    }

    public computePlaceholder(pmfm: PmfmStrategy): string {
        if (!pmfm) return undefined;
        if (!pmfm.qualitativeValues) return pmfm.name;
        return pmfm.qualitativeValues
            .reduce((res, qv) => (res + "/" + (qv.label || qv.name)), "").substr(1);
    }

    public _onBlur(event: FocusEvent) {
        // When leave component without object, use implicit value if stored
        if (typeof this.formControl.value !== "object" && this._implicitValue) {
            this.writeValue(this._implicitValue);
        }
        this.markAsTouched();
        this.onBlur.emit(event);
    }

    private startsWithUpperCase(input: string, search: string): boolean {
        return input && input.toUpperCase().substr(0, search.length) === search;
    }

    referentialToLabel(obj: Referential | any): string {
        return obj && obj.label || '';
    }

    clear() {
        this.formControl.setValue(null);
    }
}