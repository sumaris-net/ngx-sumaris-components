import {environment} from '../../../../environments/environment';
import {Entity, isInstanceOf} from './entity.model';

export function EntityClass(opts: {
  typename: string;
  fromObjectAlwaysNew?: boolean;
  fromObjectReuseStrategy?: 'default' | 'clone';
}) {

  opts = {
    fromObjectReuseStrategy: 'default',
    ...opts
  };

  return function <T extends new(...args: any[]) => {}>(constructor: T) {

    // Make sure the class extends Entity
    if (!environment.production) {
      const obj = new constructor();
      if (!(obj instanceof Entity)) {
        throw new Error(`Class ${constructor.name} must extends <<Entity>> to be able to use @FromObject!`);
      }
    }

    const typename = opts.typename || `${constructor.name}VO`;

    if (opts.fromObjectReuseStrategy === 'clone') {
      const decoratedClass = class extends constructor {
        static TYPENAME = typename;
        static fromObject(source: any, opts?: any): T {
          if (!source) return undefined;
          if (source instanceof decoratedClass) return (source as any).clone(opts) as T;
          const target: any = new decoratedClass();
          target.fromObject(source, opts);
          return target as T;
        }
      };
      return decoratedClass;
    }

    const decoratedClass = class extends constructor {
      static TYPENAME = typename;
      static fromObject(source: any, opts?: any): T {
        if (!source) return undefined;
        if (source instanceof decoratedClass) {
          // DEBUG
          //console.debug('@EntityClass() fromObject() => will recycle existing object: ', source);
          return source as T;
        }
        const target: any = new decoratedClass();
        target.fromObject(source, opts);
        return target as T;
      }
    };
    return decoratedClass;
  };
}
