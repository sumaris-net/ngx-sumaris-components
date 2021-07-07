import {AppTable} from './table.class';
import {debounceTime} from 'rxjs/operators';
import {firstFalsePromise} from '../../shared/observables';

export class AppTableUtils {

  static waitIdle(table: AppTable<any, any, any>): Promise<void> {
    if (!table || !table.dataSource) {
      throw new Error('Invalid table. Missing table or table.dataSource');
    }
    return table.dataSource.waitIdle();
  }
}
