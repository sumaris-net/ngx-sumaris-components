import {AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn} from '@angular/forms';
import * as momentImported from 'moment';
const moment = momentImported;
import {DATE_ISO_PATTERN, PUBKEY_REGEXP} from '../constants';
import {changeCaseToUnderscore, isEmptyArray, isNil, isNilOrBlank, isNotNil, isNotNilOrBlank, isNotNilOrNaN, toBoolean} from '../functions';
import {Moment} from 'moment';
import {fromDateISOString} from '../dates';

// @dynamic
export class SharedValidators {

  static validDate(control: FormControl): ValidationErrors | null {
    const value = control.value;
    const date = !value || moment.isMoment(value) ? value : moment(control.value, DATE_ISO_PATTERN);
    if (date && (!date.isValid() || date.year() < 1970)) {
      return {validDate: true};
    }
    return null;
  }

  static latitude(control: FormControl): ValidationErrors | null {
    const value = control.value;
    if (isNotNil(value) && (value < -90 || value > 90)) {
      return {latitude: true};
    }
    return null;
  }

  static longitude(control: FormControl): ValidationErrors | null {
    const value = control.value;
    if (isNotNil(value) && (value < -180 || value > 180)) {
      return {longitude: true};
    }
    return null;
  }

  static object(control: FormControl): ValidationErrors | null {
    const value = control.value;
    if (value && typeof value !== 'object') {
      return {object: true};
    }
    return null;
  }

  static entity(control: FormControl): ValidationErrors | null {
    const value = control.value;
    if (value && (typeof value !== 'object' || value.id === undefined || value.id === null)) {
      return {entity: true};
    }
    return null;
  }

  static empty(control: FormControl): ValidationErrors | null {
    if (isNotNilOrBlank(control.value)) {
      return {empty: true};
    }
    return null;
  }

  static pubkey(control: FormControl): ValidationErrors | null {
    const value = control.value;
    if (value && (typeof value !== 'string' || !PUBKEY_REGEXP.test(value))) {
      return {pubkey: true};
    }
    return null;
  }

  static integer(control: FormControl): ValidationErrors | null {
    if (isNilOrBlank(control.value))
      return null;
    const value = parseFloat(control.value);
    if (isNaN(value) || (value | 0) !== value) {
      return {integer: true};
    }
    return null;
  }

  static double(opts?: { maxDecimals?: number }): ValidatorFn {
    let regexpStr;
    if (opts && isNotNil(opts.maxDecimals)) {
      if (opts.maxDecimals < 0) throw new Error(`Invalid maxDecimals value: ${opts.maxDecimals}`);
      regexpStr = opts.maxDecimals > 1 ? `^[-]?[0-9]+([.,][0-9]{1,${opts.maxDecimals}})?$` : '^[-]?[0-9]+([.,][0-9])?$';
    } else {
      regexpStr = '^[-]?[0-9]+([.,][0-9]*)?$';
    }

    const regexp = new RegExp(regexpStr);
    return (control: FormControl): ValidationErrors | null => {
      let value = control.value;
      if (Number.isNaN(value)) {
        //console.log("WARN: Getting a NaN value !");
        value = null;
      }
      if (isNotNil(value) && value !== '' && !regexp.test(value as string)) {
        return {maxDecimals: true};
      }
      return null;
    };
  }

  static dateIsAfter(previousValue: Moment, errorParam: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = fromDateISOString(control.value);
      if (isNotNil(value) && isNotNil(previousValue) && value.isSameOrBefore(previousValue, 'day')) {
        // Return the error
        return {dateIsAfter: {minDate: errorParam}};
      }
      return null;
    };
  }

  static dateRange(fieldName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) {
        console.warn(`Cannot find brother control '${fieldName}': no parent form`);
        return null;
      }
      const previousValue = fromDateISOString(control.parent.get(fieldName).value);
      const value = fromDateISOString(control.value);
      if (isNotNil(value) && isNotNil(previousValue) && value.isSameOrBefore(previousValue)) {
        // Return the error
        return {dateRange: true};
      }
      return null;
    };
  }

  static copyParentErrors(errorNames?: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      // Skip if control already has some errors
      if (control.errors) return null;

      const errors = control.parent && control.parent.errors;

      // No errors, or copy all errors
      if (!errors || isEmptyArray(errorNames)) return errors;

      // Copy only expected errors
      return Object.keys(errors).reduce((res, key) => {
        if (errorNames.includes(key)) {
          res[key] = errors[key];
        }
        return res;
      }, {});
    };
  }

  static clearError(control: AbstractControl, errorCode: string) {
    if (control.hasError(errorCode)) {
      const errors = control.errors;
      if (errors && errors[errorCode]) {
        // Only one error: reset errors
        if (Object.getOwnPropertyNames(errors).length === 1) {
          control.setErrors(null);
        }
        // Other errors exists: just remove this error
        else {
          delete errors[errorCode];
          control.setErrors(errors);
        }
      }
    }
  }

  static translateError(translateFn: (key: string, obj?: any) => string, errorKey: string, errorContent?: any) {

    // Try to generate a standard error key, like 'ERROR.FIELD_xxx_xxx'
    const underscoreUppercaseKey = changeCaseToUnderscore(errorKey).toUpperCase();
    const i18nKey = 'ERROR.FIELD_' + underscoreUppercaseKey;
    let i18nMessage = translateFn(i18nKey, errorContent);
    if (i18nKey !== i18nMessage) return i18nMessage;

    // Try to use the error content, as an i18n key
    if (typeof errorContent === 'string') {
      i18nMessage = translateFn(errorContent);
      if (errorContent !== i18nMessage) return i18nMessage;
    }

    // Not translated: show error
    console.error(`[validator] Cannot translate error key '${errorKey}'. Please override getI18nError() in your validator`);

    return underscoreUppercaseKey;
  }
}

// @dynamic
export class SharedFormGroupValidators {

  static dateRange(startDateField: string, endDateField: string): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const endField = group.get(endDateField);
      const startDate = fromDateISOString(group.get(startDateField).value);
      const endDate = fromDateISOString(endField.value);
      if (isNotNil(startDate) && isNotNil(endDate) && startDate.isAfter(endDate)) {
        // Update end field
        endField.markAsPending();
        endField.setErrors({
          ...endField.errors,
          dateRange: true
        });
        // Return the error (should be apply to the parent form)
        return {dateRange: true};
      }
      // OK: remove the existing on the end field
      SharedValidators.clearError(endField, 'dateRange');
      return null;
    };
  }

  static dateMaxDuration(startDateField: string, endDateField: string, maxDuration: number, durationUnit?: moment.unitOfTime.Diff): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const endField = group.get(endDateField);
      const startDate = fromDateISOString(group.get(startDateField).value);
      const endDate = fromDateISOString(endField.value);
      if (isNotNil(startDate) && isNotNil(endDate) && Math.abs(startDate.diff(endDate, durationUnit)) > maxDuration) {
        // Update end field
        const endFieldErrors: ValidationErrors = endField.errors || {};
        endFieldErrors['dateMaxDuration'] = true;
        endField.setErrors(endFieldErrors);
        endField.markAsTouched({onlySelf: true});
        // Return the error (should be apply to the parent form)
        return {dateMaxDuration: true};
      }
      // OK: remove the existing on the end field
      else {
        SharedValidators.clearError(endField, 'dateMaxDuration');
      }
      return null;
    };
  }

  static dateMinDuration(startDateField: string, endDateField: string, minDuration: number, durationUnit?: moment.unitOfTime.Diff): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const endField = group.get(endDateField);
      const startDate = fromDateISOString(group.get(startDateField).value);
      const endDate = fromDateISOString(endField.value);
      if (isNotNil(startDate) && isNotNil(endDate) && Math.abs(startDate.diff(endDate, durationUnit)) < minDuration) {
        // Update end field
        const endFieldErrors: ValidationErrors = endField.errors || {};
        endFieldErrors['dateMinDuration'] = true;
        endField.setErrors(endFieldErrors);
        endField.markAsTouched({onlySelf: true});
        // Return the error (should be apply to the parent form)
        return {dateMinDuration: true};
      }
      // OK: remove the existing on the end field
      else {
        SharedValidators.clearError(endField, 'dateMinDuration');
      }
      return null;
    };
  }

  static requiredIf(fieldName: string, anotherFieldToCheck: string | AbstractControl): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const control = group.get(fieldName);
      const anotherControl = (anotherFieldToCheck instanceof AbstractControl) ? anotherFieldToCheck : group.get(anotherFieldToCheck);
      if (!anotherControl) throw new Error('Unable to find field to check!');
      if (isNilOrBlank(control.value) && isNotNilOrBlank(anotherControl.value)) {
        const error = {required: true};
        control.setErrors(error);
        control.markAsTouched({onlySelf: true});
        return error;
      }
      SharedValidators.clearError(control, 'required');
      return null;
    };
  }

  static requiredIfTrue(fieldName: string, anotherFieldToCheck: string | AbstractControl): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const control = group.get(fieldName);
      const anotherControl = (anotherFieldToCheck instanceof AbstractControl) ? anotherFieldToCheck : group.get(anotherFieldToCheck);
      if (!anotherControl) throw new Error('Unable to find field to check!');
      if (isNilOrBlank(control.value) && toBoolean(anotherControl.value, false)) {
        const error = {required: true};
        control.setErrors(error);
        control.markAsTouched({onlySelf: true});
        return error;
      }
      SharedValidators.clearError(control, 'required');
      return null;
    };
  }

  static requiredIfEmpty(fieldName: string, anotherFieldToCheck: string): ValidatorFn {
    return (group: FormGroup): ValidationErrors | null => {
      const control = group.get(fieldName);
      if (isNilOrBlank(control.value) && isNilOrBlank(group.get(anotherFieldToCheck).value)) {
        const error = {required: true};
        control.setErrors(error);
        control.markAsTouched({onlySelf: true});
        return error;
      }
      SharedValidators.clearError(control, 'required');
      return null;
    };
  }

  static propagateIfDirty(fieldName: string, fieldNameToPropagate: string, valueToPropagate: any): ValidatorFn {
    return (group: FormGroup): null => {
      const control = group.get(fieldName);
      const controlToPropagate = group.get(fieldNameToPropagate);
      if (control.dirty && controlToPropagate.value !== valueToPropagate) {
        controlToPropagate.setValue(valueToPropagate);
      }
      return null;
    };
  }
}

// @dynamic
export class SharedFormArrayValidators {

  /**
   * Validate uniqueness of an entity in a FormArray
   *
   * @param controlName the name of the control in FormArray
   */
  static uniqueEntity(controlName: string): ValidatorFn {
    return (array: FormArray): ValidationErrors | null => {
      const controls: AbstractControl[] = [];
      if (array.length) {
        // gather controls in array with valid entity
        for (const control of array.controls) {
          const fromGroup = control as FormGroup;
          if (fromGroup.controls[controlName]) {
            const value = fromGroup.controls[controlName].value;
            if (!!value && !!value.id)
              controls.push(fromGroup.controls[controlName]);
          }
        }
        // get occurrences of entity by id
        const occurrences = controls.reduce((acc, control) => {
          const id = control.value.id;
          acc[id] ? acc[id]++ : acc[id] = 1;
          return acc;
        }, {});
        // get controls with value occurrences > 1
        const error = {uniqueEntity: true};
        let returnError = false;
        controls.filter(control => occurrences[control.value.id] > 1)
          .forEach(control => {
            let errors: ValidationErrors = control.errors || {};
            errors = {...errors, ...error};
            control.setErrors(errors);
            control.markAsTouched({onlySelf: true});
            returnError = true;
          });
        if (returnError)
          return error;
      }
      controls.forEach(control => SharedValidators.clearError(control, 'uniqueEntity'));
      return null;
    };
  }

  static requiredArrayMinLength(minLength?: number): ValidatorFn {
    minLength = minLength || 1;
    return (array: FormArray): ValidationErrors | null => {
      if (!array || array.length < minLength) {
        return {required: true};
      }
      return null;
    };
  }

  /**
   * Validate the sum of control values in an FormArray not overflow the max value
   *
   * @param controlName the name of the control in FormArray
   * @param max the maximum value
   */
  static validSumMaxValue(controlName: string, max: number): ValidatorFn {
    return (array: FormArray): ValidationErrors | null => {
      const controls: AbstractControl[] = [];
      if (array.length) {
        for (const control of array.controls) {
          const fromGroup = control as FormGroup;
          if (fromGroup.controls[controlName] && isNotNilOrNaN(fromGroup.controls[controlName].value)) {
            controls.push(fromGroup.controls[controlName]);
          }
        }
        if (controls.reduce((sum, control) => sum + control.value, 0) > max) {
          const error = {sumMaxValue: true};
          controls.forEach(control => {
            let errors: ValidationErrors = control.errors || {};
            errors = {...errors, ...error};
            control.setErrors(errors);
            control.markAsTouched({onlySelf: true});
          });
          return error;
        }
      }
      controls.forEach(control => SharedValidators.clearError(control, 'sumMaxValue'));
      return null;
    };
  }

}
