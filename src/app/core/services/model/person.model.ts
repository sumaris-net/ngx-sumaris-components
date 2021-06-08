import {Moment} from 'moment';
import {ReferentialAsObjectOptions} from './referential.model';
import {Entity} from './entity.model';
import {Department, departmentToString} from './department.model';
import {fromDateISOString, toDateISOString} from '../../../shared/dates';
import {EntityClass} from './entity.decorators';


export type UserProfileLabel = 'ADMIN' | 'USER' | 'SUPERVISOR' | 'GUEST';

// Enumeration for User profile.
// /!\ WARN: Field order is used to known profile hierarchy
export const UserProfileLabels = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  USER: 'USER',
  GUEST: 'GUEST'
};

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
  department: Department;
  profiles: string[];
  mainProfile: string;

  constructor(__typename?: string) {
    super(__typename || Person.TYPENAME);
    this.department = null;
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
    target.profiles = this.mainProfile && [this.mainProfile] || target.profiles || [UserProfileLabels.GUEST];
    target.creationDate = toDateISOString(this.creationDate);

    if (!opts || opts.minify !== true) target.mainProfile = getMainProfile(target.profiles);
    return target;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.firstName = source.firstName;
    this.lastName = source.lastName;
    this.email = source.email;
    this.creationDate = fromDateISOString(source.creationDate);
    this.pubkey = source.pubkey;
    this.avatar = source.avatar;
    this.statusId = source.statusId;
    this.department = source.department && Department.fromObject(source.department) || undefined;
    this.profiles = source.profiles && source.profiles.slice(0) || [];
    // Add main profile to the list, if need
    if (source.mainProfile && !this.profiles.find(p => p === source.mainProfile)) {
      this.profiles = this.profiles.concat(source.mainProfile);
    }
    this.mainProfile = getMainProfile(this.profiles);
  }
}

export class PersonUtils {
  static getMainProfile = getMainProfile;
  static getMainProfileIndex = getMainProfileIndex;
  static hasUpperOrEqualsProfile = hasUpperOrEqualsProfile;
  static personToString = personToString;
  static personsToString = personsToString;
}

export function getMainProfile(profiles?: string[]): string {
  if (!profiles && !profiles.length) return UserProfileLabels.GUEST;
  return Object.values(UserProfileLabels).find(label => profiles.includes(label)) || UserProfileLabels.GUEST;
}

export function getMainProfileIndex(profiles?: string[]): number {
  if (!profiles && !profiles.length) return Object.values(UserProfileLabels).length - 1; // return last (lower) profile
  const index = Object.values(UserProfileLabels).findIndex(label => profiles.includes(label));
  return (index !== -1) ? index : (Object.values(UserProfileLabels).length - 1);
}

export function hasUpperOrEqualsProfile(actualProfiles: string[], expectedProfile: UserProfileLabel): boolean {
  const expectedProfileIndex = Object.keys(UserProfileLabels).indexOf(expectedProfile);
  return expectedProfileIndex !== -1 && getMainProfileIndex(actualProfiles) <= expectedProfileIndex;
}

export function personToString(obj: Person): string {
  return obj && obj.id && (obj.lastName + ' ' + obj.firstName) || undefined;
}

export function personsToString(data: Person[], separator?: string): string {
  return (data || []).map(personToString).join(separator || ', ');
}
