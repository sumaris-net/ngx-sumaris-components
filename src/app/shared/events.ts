import {EventEmitter} from '@angular/core';

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

