import {BaseReferential} from './referential.model';
import {EntityClass} from './entity.decorators';

// @dynamic
@EntityClass({typename: 'DepartmentVO'})
export class Department extends BaseReferential<Department> {

  static ENTITY_NAME = 'Department';
  static fromObject: (source: any, opts?: any) => Department;

  logo: string;
  siteUrl: string;

  constructor() {
    super(Department.TYPENAME);
    this.entityName = Department.ENTITY_NAME;
  }

  fromObject(source: any) {
    super.fromObject(source);
    this.entityName = source.entityName || Department.ENTITY_NAME;
    this.logo = source.logo;
    this.siteUrl = source.siteUrl;
    delete this.entityName; // not need
  }
}

export function departmentToString(obj: Department): string {
  return obj && obj.id && (obj.name) || undefined;
}

export function departmentsToString(data: Department[], separator?: string): string {
  return (data || []).map(departmentToString).join(separator || ', ');
}
