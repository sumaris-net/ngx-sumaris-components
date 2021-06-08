
const regexp = {
  POSITIVE_INTEGER: /^\d+$/,
  VERSION_PART_REGEXP: /^[0-9]+|alpha[0-9]+|beta[0-9]+|rc[0-9]+|[0-9]+-SNAPSHOT$/
};


export class VersionUtils {
  static compare = compareVersionNumbers;
  static isCompatible = isVersionCompatible;
}

/**
 * Compare two software version numbers (e.g. 1.7.1)
 * Returns:
 *
 *  0 if they're identical
 *  negative if v1 < v2
 *  positive if v1 > v2
 *  Nan if they in the wrong format
 *
 *  E.g.:
 *
 *  assert(version_number_compare("1.7.1", "1.6.10") > 0);
 *  assert(version_number_compare("1.7.1", "1.7.10") < 0);
 *
 *  "Unit tests": http://jsfiddle.net/ripper234/Xv9WL/28/
 *
 *  Taken from http://stackoverflow.com/a/6832721/11236
 */
 export function compareVersionNumbers(v1, v2){
  const v1parts = v1.split('.');
  const v2parts = v2.split('.');

  // First, validate both numbers are true version numbers

  if (!validateParts(v1parts) || !validateParts(v2parts)) {
    return NaN;
  }

  for (let i = 0; i < v1parts.length; ++i) {
    if (v2parts.length === i) {
      return 1;
    }

    if (v1parts[i] === v2parts[i]) {
      continue;
    }
    if (v1parts[i] > v2parts[i]) {
      return 1;
    }
    return -1;
  }

  if (v1parts.length != v2parts.length) {
    return -1;
  }

  return 0;
}

function validateParts(parts) {
  for (let i = 0; i < parts.length; i++) {
    let isNumber = regexp.POSITIVE_INTEGER.test(parts[i]);
    // First part MUST be an integer
    if (i === 0 && !isNumber) return false;
    // If not integer, should be 'alpha', 'beta', etc.
    if (!isNumber) {
      if (!regexp.VERSION_PART_REGEXP.test(parts[i])) return false;
      // Remove '-SNAPSHOT', as it should never be in prod
      parts[i] = parts[i].replace('-SNAPSHOT', '');
      // Check again if numeric
      isNumber = regexp.POSITIVE_INTEGER.test(parts[i]);
    }

    // Convert string to int (need by compare operators)
    if (isNumber) parts[i] = parseInt(parts[i]);
  }
  return true;
}

export function isVersionCompatible(minVersion, actualVersion) {
  // DEV ONLY
  //console.debug(`[http] Checking actual version {${actualVersion}} is compatible with min expected version {${minVersion}}`);
  return compareVersionNumbers(minVersion, actualVersion) <= 0;
}
