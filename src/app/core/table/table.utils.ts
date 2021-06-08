import {AppTable} from "./table.class";
import {debounceTime} from "rxjs/operators";
import {firstFalsePromise} from "../../shared/observables";

export class AppTableUtils {

  static async waitIdle(table: AppTable<any, any, any>) {

    if (!table || !table.dataSource) {
      throw Error("Invalid table. Missing table or table.dataSource")
    }

    await firstFalsePromise(table.dataSource.$busy.asObservable()
      .pipe(
        debounceTime(100), // if not started yet, wait
      ));

  }

}
