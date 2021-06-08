import {ElementRef, EventEmitter} from '@angular/core';
import {Subject} from 'rxjs';

export class MemoryUtils {

 static cleanup(object: any, opts?: {
   path?: string;
   depth?: number;
   debug?: boolean;
 }) {
   if (!object || (opts && opts.depth >= 5)) return;

   if (object instanceof ElementRef) {
     if (opts && opts.debug) console.debug('Force closing event emitter: ' + (opts && opts.path) );
     object.nativeElement.remove();
     return;
   }

   if (object instanceof EventEmitter && !object.closed) {
     if (opts && opts.debug) console.debug('Force closing event emitter: ' + (opts && opts.path) );
     object.complete();
     return;
   }
   if (object instanceof Subject && !object.closed) {
     if (opts && opts.debug) console.debug('Force closing subject: ' + (opts && opts.path) );
     object.complete();
     return;
   }

   //if (opts && opts.debug && opts.path) console.debug("Looking for unclosed observables at " + (opts && opts.path) );

   Object.keys(object).forEach(key => {
     if (key.startsWith('parent')
       || key.startsWith('_parent')
       || key.startsWith('_ngZone')
       || key.startsWith('__ngContext')
       || key.startsWith('_changeDetectorRef')
       || key.startsWith('ngControl')) {
       //object[key] = null;
       return;
     } // Skip

     if (key.startsWith('trigger')
       || key.startsWith('value')) {
       // Recursive call
       MemoryUtils.cleanup(object[key], {
         ...opts,
         path: (opts && opts.path || '') + '/' + key,
         depth: (opts && opts.depth || 0) + 1
       });
     }
   });
 }
}
