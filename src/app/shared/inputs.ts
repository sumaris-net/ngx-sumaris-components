import {ElementRef, QueryList} from '@angular/core';
import {FocusableElement, isFocusableElement} from './focusable';
import {isNil, isNilOrBlank, isNotEmptyArray, isNotNil, toBoolean, toNumber} from './functions';


export function selectInputContent(event: UIEvent) {
  if (event.defaultPrevented) return false;
  const input = (event.target as any);
  if (input && typeof input.select === 'function') {

    // Nothing to select
    if (isNilOrBlank(input.value)) return false;

    try {
      input.select();
    } catch (err) {
      console.error('Could not select input content', err);
      return false;
    }
  }
  return true;
}

export function selectInputRange(input: any, startIndex: number, endIndex?: number) {
  if (input && typeof input.setSelectionRange === 'function') {

    // No content
    if (isNilOrBlank(input.value)) return false;

    try {
      input.setSelectionRange(startIndex, isNotNil(endIndex) ? endIndex : startIndex);
    } catch (err) {
      console.error('Could not select input range', err);
      return false;
    }
  }
  return true;
}

export function getCaretPosition(input: any): number {
  if (input && input.selectionStart) {
    return input.selectionDirection ?
      (input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd) : input.selectionStart;
  }
  return -1;
}

export function moveInputCaretToSeparator(event: KeyboardEvent, separator: string, forward?: boolean) {
  if (event.defaultPrevented || !separator) return false;
  const input = (event.target as any);
  if (!input) return true;

  const caretPosition = getCaretPosition(input);

  // DEBUG
  console.debug('caretPosition=', caretPosition);

  if (caretPosition == -1) return true; // Caret pos not found: skip

  // Get input value
  const value = input.value as string;

  // No content: skip
  if (isNilOrBlank(value)) return false;

  try {


    if (value && caretPosition <= value.length) {
      // DEBUG
      //console.debug("Input text value: ", value);
      //console.debug("Cursor at: ", caretPosition);
      //console.debug("Text after cursor: ", value.substr(caretPosition));
      //console.debug("Next separator at: ", value.indexOf(separator, caretPosition));

      forward = forward !== false;

      const separatorIndex = (forward ? value.indexOf(separator, caretPosition) : value.lastIndexOf(separator, caretPosition));
      if (separatorIndex !== -1 && ((forward && separatorIndex + 1 < value.length)
        || (!forward && separatorIndex > 0))) {
        if (input.setSelectionRange) {
          // Move after the next separator
          if (selectInputRange(input, separatorIndex + (forward ? 1 : -1))) {
            // Stop the keyboard event
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    }
  } catch (err) {
    console.error('Could not move caret to next separator', err);
    return false;
  }
  return true;
}

export function filterNumberInput(event: KeyboardEvent, allowDecimals: boolean, decimalSeparator?: string) {
  //input number entered or one of the 4 direction up, down, left and right
  if ((event.which >= 48 && event.which <= 57) || (event.which >= 37 && event.which <= 40)) {
    //console.debug('input number entered :' + event.which + ' ' + event.keyCode + ' ' + event.charCode);
    // OK
  }
  // Decimal separator
  else if (allowDecimals && ((!decimalSeparator && (event.key === '.' || event.key === ','))
    || (decimalSeparator && event.key === decimalSeparator))) {
    //console.debug('input decimal separator entered :' + event.code);
    // OK
  } else {
    //input command entered of delete, backspace or one of the 4 direction up, down, left and right, or negative sign
    if ((event.keyCode >= 37 && event.keyCode <= 40) || event.keyCode == 46 || event.which == 8 || event.keyCode == 9 || event.keyCode == 45) {
      //console.debug('input command entered :' + event.which + ' ' + event.keyCode + ' ' + event.charCode);
      // OK
    }
    // Cancel other keyboard events
    else {
      //console.debug('input not number entered :' + event.which + ' ' + event.keyCode + ' ' + event.charCode + ' ' + event.code );
      event.preventDefault();
    }
  }
}

export function focusInput(element: ElementRef) {
  const inputElement = asInputElement(element);
  if (inputElement)
    inputElement.focus();
  else {
    console.warn('Trying to focus on this element:', element);
  }
}

export function setTabIndex(element: ElementRef, tabIndex: number) {
  if(isInputElement(element)) {
    element.tabindex = tabIndex;
  }
  else if (element && isInputElement(element.nativeElement)) {
    element.nativeElement.tabIndex = tabIndex;
  }
  else {
    console.warn('Trying to change tabindex on this element:', element);
  }
}

export interface InputElement extends FocusableElement {
  tabindex?: number;
  tabIndex?: number;
  hidden?: boolean;
  disabled?: boolean;
  value: any;
}
export function isInputElement(object: any): object is InputElement {
  return isFocusableElement(object)
    && ('value' in object
      // has value is not always set (neither tabindex) check on 2 properties with a logical OR
      || ('tabindex' in object || 'tabIndex' in object));
}

export function asInputElement(object: ElementRef): InputElement|undefined {
  if (object) {
    if (isInputElement(object)) return object;
    if (object.nativeElement && isInputElement(object.nativeElement)) return object.nativeElement;
  }
  return undefined;
}

export function tabindexComparator(a: InputElement, b: InputElement) {
  const valueA = a.tabindex || a.tabIndex;
  const valueB = b.tabindex || b.tabIndex;
  return valueA === valueB ? 0 : (valueA > valueB ? 1 : -1);
}

export interface CanGainFocusOptions {
  minTabindex?: number;
  maxTabindex?: number;
  excludeEmptyInput?: boolean;
}

export interface GetFocusableInputOptions extends CanGainFocusOptions {
  sortByTabIndex?: boolean;
  debug?: boolean;
}

export function canHaveFocus(input: InputElement, opts?: CanGainFocusOptions): boolean {
  if (!input) return false;
  // Exclude disabled element
  return !toBoolean(input.disabled, false)
    // Exclude hidden element
    && !toBoolean(input.hidden, false)
    // Exclude minTabIndex < element.tabIndex
    && (isNil(opts.minTabindex) || toNumber(input.tabIndex, input.tabindex) > opts.minTabindex)
    // Exclude maxTabIndex > element.tabIndex
    && (isNil(opts.maxTabindex) || toNumber(input.tabIndex, input.tabindex) < opts.maxTabindex)
    // Exclude nil input value
    && (!opts.excludeEmptyInput || isNilOrBlank(input.value));
}

export function getFocusableInputElements(elements: QueryList<ElementRef>, opts?: GetFocusableInputOptions): InputElement[] {
  opts = {sortByTabIndex: false, excludeEmptyInput: false, ...opts};

  // Focus to first input
  const filteredElements: InputElement[] = elements

    // Transform to input
    .map(asInputElement)

    .filter(input => {
      const included = canHaveFocus(input, opts);
      // DEBUG
      if (input && opts.debug) console.debug(`[inputs] Focusable input {canFocus: ${included}, tabIndex: ${input.tabIndex||input.tabindex}}`, input);
      return included;
    });

  // Sort by tabIndex
  if (opts.sortByTabIndex) {
    return filteredElements.sort(tabindexComparator);
  }

  return filteredElements;

}


export function focusNextInput(event: UIEvent|undefined, elements: QueryList<ElementRef>, opts?: GetFocusableInputOptions): boolean {

  // Cancelling event (e.g. when emitted by (keydown.tab) )
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Get current index
  const minTabindex = event && isInputElement(event.target) ? (event.target.tabIndex || event.target.tabindex) : undefined;

  // Get focusable input elements
  const focusableInputs: InputElement[] = getFocusableInputElements(elements, {minTabindex, ...opts});

  if (isNotEmptyArray(focusableInputs)) {
    // Focus on first inputs
    focusableInputs[0].focus();
    return true;
  }

  return false;
}

export function focusPreviousInput(event: UIEvent|undefined, elements: QueryList<ElementRef>, opts?: GetFocusableInputOptions): boolean {

  // Cancelling event (e.g. when emitted by (keydown.tab) )
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Get current index
  const maxTabindex = event && isInputElement(event.target) ? (event.target.tabIndex || event.target.tabindex) : undefined;

  // Get focusable input elements
  const focusableInputs: InputElement[] = getFocusableInputElements(elements, {maxTabindex, ...opts});

  if (isNotEmptyArray(focusableInputs)) {
    // Focus on last inputs
    focusableInputs[focusableInputs.length -1].focus();
    return true;
  }

  return false;
}

