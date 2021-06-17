import {Moment} from 'moment';
import {ReferentialAsObjectOptions} from './referential.model';
import {Entity} from './entity.model';
import {Department} from './department.model';
import {fromDateISOString, toDateISOString} from '../../../shared/dates';
import {EntityClass} from './entity.decorators';


export type UserProfileLabel = 'ADMIN' | 'USER' | 'SUPERVISOR' | 'GUEST';
export const PRIORITIZED_AUTHORITIES: Readonly<UserProfileLabel[]> = Object.freeze(['ADMIN', 'SUPERVISOR', 'USER', 'GUEST']);

// @dynamic
@EntityClass({typename: 'PersonVO'})
export class Person<
  T extends Person<any> = Person<any>
  > extends Entity<T, number, ReferentialAsObjectOptions> {

  static fromObject: (source: any, opts?: any) =>  Person;

  firstName: string;
  lastName: string;
  email: string;
  pubkey: string;
  avatar: string;
  creationDate: Date | Moment;
  statusId: number;
  department: Department = null;
  username: string;
  usernameExtranet: string;
  profiles: string[];
  mainProfile: string;

  constructor(__typename?: string) {
    super(__typename || Person.TYPENAME);
  }

  asObject(opts?: ReferentialAsObjectOptions): any {
    if (opts && opts.minify)  {
      return {
        id: this.id,
        __typename: opts.keepTypename && this.__typename || undefined,
        firstName: this.firstName,
        lastName: this.lastName
      };
    }
    const target: any = super.asObject(opts);
    target.department = this.department && this.department.asObject(opts) || undefined;
    target.profiles = this.profiles && this.profiles.slice(0) || [];
    // Set profile list from the main profile
    target.profiles = this.mainProfile && [this.mainProfile] || target.profiles;
    target.creationDate = toDateISOString(this.creationDate);

    if (!opts || opts.minify !== true) target.mainProfile = PersonUtils.getMainProfile(target.profiles);
    return target;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.firstName = source.firstName;
    this.lastName = source.lastName;
    this.email = source.email;
    this.creationDate = fromDateISOString(source.creationDate);
    this.pubkey = source.pubkey;
    this.username = source.username;
    this.usernameExtranet = source.usernameExtranet;
    this.avatar = source.avatar;
    this.statusId = source.statusId;
    this.department = source.department && Department.fromObject(source.department) || undefined;
    this.profiles = source.profiles && source.profiles.slice(0) || [];
    // Add main profile to the list, if need
    if (source.mainProfile && !this.profiles.find(p => p === source.mainProfile)) {
      this.profiles = this.profiles.concat(source.mainProfile);
    }
    this.mainProfile = PersonUtils.getMainProfile(this.profiles);
  }
}

export class PersonUtils {
  static getMainProfile(profiles?: string[]): UserProfileLabel {
    if (!profiles && !profiles.length) return 'GUEST';
    return PRIORITIZED_AUTHORITIES.find(label => profiles.includes(label)) || 'GUEST';
  }

  static getMainProfileIndex(profiles?: string[]): number {
    if (!profiles && !profiles.length) return PRIORITIZED_AUTHORITIES.length - 1; // return last (lower) profile
    const index = PRIORITIZED_AUTHORITIES.findIndex(label => profiles.includes(label));
    return (index !== -1) ? index : (PRIORITIZED_AUTHORITIES.length - 1);
  }

  static hasUpperOrEqualsProfile(actualProfiles: string[], expectedProfile: UserProfileLabel): boolean {
    const expectedProfileIndex = PRIORITIZED_AUTHORITIES.indexOf(expectedProfile);
    return expectedProfileIndex !== -1 && PersonUtils.getMainProfileIndex(actualProfiles) <= expectedProfileIndex;
  }

  static personToString(obj: Person): string {
    return obj && obj.id && (obj.lastName + ' ' + obj.firstName) || undefined;
  }

  static personsToString(data: Person[], separator?: string): string {
    return (data || []).map(PersonUtils.personToString).join(separator || ', ');
  }

}







