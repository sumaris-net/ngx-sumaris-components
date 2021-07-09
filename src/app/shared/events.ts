import {EventEmitter} from '@angular/core';
import {fromEvent, Observable} from 'rxjs';
import {filter} from 'rxjs/operators';

export interface PromiseEventPayload<T = any> {
  success: (T) => void;
  error: (err: any) => void;
}

export type PromiseEvent<T = any, D = void> = CustomEvent<PromiseEventPayload<T> & D>;

export function createPromiseEventEmitter<T = any, D = void>(): EventEmitter<PromiseEvent<T, D>> {
  return new EventEmitter<PromiseEvent<T, D>>(true);
}

export function createPromiseEvent<T = void, D = void>(eventType: string,
                                                      promise: PromiseEventPayload<T>,
                                                      initArg?: CustomEventInit<D>
  ): PromiseEvent<T, D> {

  const detail = <PromiseEventPayload & D>{
    ...(initArg && initArg.detail || {}),
    ...promise
  };
  return new CustomEvent<PromiseEventPayload<T> & D>(eventType, {detail});
}

export function emitPromiseEvent<T = any, D = void>(emitter: EventEmitter<PromiseEvent<T, D>>,
                                                   eventType: string,
                                                   initArg?: CustomEventInit<D>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const event = createPromiseEvent(eventType, {
      success: resolve,
      error: reject
    }, initArg);
    emitter.emit(event);
  });
}

export interface CompletableEvent extends Event {
  target: EventTarget & { complete?: () => void };
}

/**
 * Listen end of scroll.
 * <p>
 *   The threshold distance from the bottom of the content to call the infinite output event when scrolled.
 *   The threshold value can be either a percent, or in pixels.
 *   For example, use the value of 10% for the infinite output event to get called when the user has scrolled
 *   10% from the bottom of the page. Use the value 100px when the scroll is within 100 pixels from the bottom of the page.
 * </p>
 * @param element
 * @param threshold default to '15%'
 */
export function fromScrollEndEvent(element: HTMLElement, threshold?: string): Observable<any> {

  threshold = threshold || '15%';
  let isEnd: () => boolean;

  // Listen using percentage
  if (threshold.endsWith('%')) {
    const thresholdRatio = parseInt(threshold.slice(0, threshold.length - 1)) / 100;
    isEnd = () => {
      const endPosRatio = 1 - (element.scrollTop + element.offsetHeight) / element.scrollHeight;
      return endPosRatio < thresholdRatio;
    };
  }

  // Listen using pixels
  else if (threshold.endsWith('px')) {
    const thresholdPx = parseInt(threshold.slice(0, threshold.length - 2));
    isEnd = () => {
      const endPosPx = element.scrollHeight - (element.scrollTop + element.offsetHeight);
      return endPosPx < thresholdPx;
    };
  }
  else {
    throw new Error('Invalid argument \'threshold\'. Expected value unit: \'px\' or \'%\' ')
  }

  return fromEvent(element, 'scroll')
    .pipe(
      filter(() => isEnd())
    );
}
