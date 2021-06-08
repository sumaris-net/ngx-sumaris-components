import {ObjectMap, Property} from '../types';
import {isNotNil} from '../functions';
import {InjectionToken} from '@angular/core';
import {MatAutocompleteFieldAddOptions} from '../material/autocomplete/material.autocomplete';

export declare type DisplayFn = (obj: any) => string;

export declare type CompareWithFn = (o1: any, o2: any) => boolean;

export declare type FormFieldType = 'integer' | 'double' | 'boolean' | 'string' | 'enum' | 'color' | 'peer' | 'entity' | 'entities';

export declare interface FormFieldDefinition<T = any> {
  key: string;
  label: string;
  minValue?: number;
  maxValue?: number;
  maximumNumberDecimals?: number;
  defaultValue?: any;
  isTransient?: boolean; // Useful only for remote configuration
  values?: (string|Property)[] | InjectionToken<(string|Property)[]>;
  type: FormFieldType;
  autocomplete?: MatAutocompleteFieldAddOptions<T>;
  disabled?: boolean;
  required?: boolean;
  extra?: {
    [key: string]: {
      disabled?: boolean;
      required: boolean;
    };
  };
}
export declare type FormFieldDefinitionMap = ObjectMap<FormFieldDefinition>;


export abstract class FormFieldValuesHolder {
  getAsBoolean(data: ObjectMap, definition: FormFieldDefinition): boolean {
    const value = this.get(data, definition);
    return isNotNil(value) ? (value && value !== 'false') : undefined;
  }

  getAsInt(data: any, definition: FormFieldDefinition): number {
    const value = this.get(data, definition);
    return isNotNil(value) ? parseInt(value) : undefined;
  }

  getAsNumbers(data: any, definition: FormFieldDefinition): number[] {
    const value = this.get(data, definition);
    if (typeof value === 'string') return value.split(',').map(parseFloat) || undefined;
    return isNotNil(value) ? [parseFloat(value)] : undefined;
  }

  getAsStrings(data: any, definition: FormFieldDefinition): string[] {
    const value = this.get(data, definition);
    return value && value.split(',') || undefined;
  }

  get<T = string>(data: any, definition: FormFieldDefinition): T {
    return isNotNil(data[definition.key]) ? data[definition.key] : (definition.defaultValue || undefined);
  }
}
