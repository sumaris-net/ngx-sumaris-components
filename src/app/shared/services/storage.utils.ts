import {isEmptyArray} from '../functions';
import {chainPromises} from '../observables';

export class StorageUtils {

  /**
   * Copy one storage content, into anthoer
   *
   * @param from
   * @param to
   */
  static async copy(from: LocalForage, to: LocalForage, options?: {
      keys: string[];
      deleteAfterCopy?: boolean;
    }) {
    if (!from || !to || from === to) throw new Error('Invalid \'from\' or \'to\' arguments. Must be not null storage');

    options = {deleteAfterCopy: false, ...options};

    // Get keys to copy
    const keys = options.keys || (await from.keys());
    if (isEmptyArray(keys)) return Promise.resolve(); // Nothing to copy

    const now = Date.now();
    console.info(`[storage-utils] Copying ${keys.length} keys from '${from.driver()}' to '${to.driver()}'... {deleteAfterCopy: ${options.deleteAfterCopy}`);
    let errorCount = 0;

    return chainPromises(
      keys.map(key => () => from.getItem(key)
        .then((data) => to.setItem(key, data))
        .then(() => options.deleteAfterCopy && from.removeItem(key))
        .catch((err) => {
          console.error(`[storage-utils] Error during migration of key '${key}'`, err);
          errorCount++;
        }))
    )
      .then(() => {
        if (errorCount === 0) {
          console.info(`[storage-utils] Migrating data [OK] in ${Date.now() - now}ms`);
        }
        else {
          throw {message: 'ERROR.COPY_STORAGE_ERROR'};
        }
      });
  }
}

