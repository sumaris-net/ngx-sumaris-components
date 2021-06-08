import {Moment} from 'moment';
import {Entity, EntityAsObjectOptions, IEntity} from '../../../core/services/model/entity.model';
import {PredefinedColors} from '@ionic/core';
import {fromDateISOString} from '../../../shared/dates';
import {EntityClass} from '../../../core/services/model/entity.decorators';

export const UserEventTypes = {
  DEBUG_DATA: 'DEBUG_DATA',
  INBOX_MESSAGE: 'INBOX_MESSAGE'
};

// @dynamic
@EntityClass({typename: 'UserEventVO'})
export class UserEvent extends Entity<UserEvent> {

  static fromObject: (source: any, opts?: any) => UserEvent;

  eventType: string;
  issuer: string;
  recipient: string;
  updateDate: Moment;
  creationDate: Moment;

  content: string | any;
  signature: string;
  readSignature: string;

  constructor() {
    super(UserEvent.TYPENAME);
  }

  asObject(opts?: EntityAsObjectOptions): any {
    const target = super.asObject(opts);

    // Serialize content
    if (typeof target.content === 'object') {
      target.content = JSON.stringify(target.content);
    }

    return target;
  }

  fromObject(source: any) {
    Object.assign(this, source); // Copy all properties
    super.fromObject(source);
    this.creationDate = fromDateISOString(source.creationDate);

    try {
      // Deserialize content
      if (typeof source.content === 'string' && source.content.startsWith('{')) {
        this.content = JSON.parse(source.content);
      }

      // Deserialize content.context
      if (this.content && typeof this.content.context === 'string' && this.content.context.startsWith('{')) {
        this.content.context = JSON.parse(this.content.context);
      }
    }
    catch(err) {
      console.error('Error during UserEvent deserialization', err);
    }
  }
}


export interface UserEventAction<T extends IEntity<T>> {

  name: string | any;
  title?: string;

  icon?: string;
  matIcon?: string;
  color?: PredefinedColors;

  executeAction: (event: UserEvent, context?: T) => any | Promise<any>;

}
