import {Injectable} from '@angular/core';
import {HammerGestureConfig} from '@angular/platform-browser';

export const HAMMER_TAP_TIME = 250;
export const HAMMER_PRESS_TIME = 400; // Increase need for double tap (default: 251 ms)
/**
 * @hidden
 * This class overrides the default Angular gesture config.
 *
 */
@Injectable({providedIn: 'root'})
export class AppGestureConfig extends HammerGestureConfig {

  // Override HammerJS default settings
  overrides = <any>{
    press: {
      time: HAMMER_PRESS_TIME
    },
    pinch: {
      enable: false
    },
    rotate: {
      enable: false
    },
    // see https://hammerjs.github.io/recognizer-swipe/
    swipe: {
      threshold: 30,  // Minimal distance required before recognizing.
      velocity: 0.4  //Minimal velocity required before recognizing, unit is in px per ms.
    }
  };

  buildHammer(element: HTMLElement) {

    // DEBUG
    console.debug('[gesture] Applying HammerJS config to ', element.tagName);

    const mc = new (<any>window).Hammer(element);

    for (const eventName in this.overrides) {
      if (eventName) mc.get(eventName).set(this.overrides[eventName]);
    }

    return mc;
  }
}
