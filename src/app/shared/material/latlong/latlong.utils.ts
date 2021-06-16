import {DEFAULT_PLACEHOLDER_CHAR} from '../../constants';

export declare type LatLongPattern = 'DDMMSS' | 'DDMM' | 'DD';
export const LAT_LONG_PATTERNS: LatLongPattern[] = ['DDMMSS', 'DDMM', 'DD'];

export declare class LatLongFormatOptions {
  pattern: LatLongPattern;
  maxDecimals?: number;
  placeholderChar?: string;
  hideSign?: boolean;
}
export declare type LatLongFormatFn = (value: number | null, opts?: LatLongFormatOptions) => string;
export const LAT_LONG_DEFAULT_MAX_DECIMALS = 3;


const DEFAULT_OPTIONS = <LatLongFormatOptions>{
  pattern: 'DDMM',
  maxDecimals: LAT_LONG_DEFAULT_MAX_DECIMALS,
  placeholderChar: DEFAULT_PLACEHOLDER_CHAR
};
const DEFAULT_LATITUDE_OPTIONS: LatLongFormatOptions & { longitude: boolean } = {
  ...DEFAULT_OPTIONS,
  longitude: false
};
const DEFAULT_LONGITUDE_OPTIONS: LatLongFormatOptions & { longitude: boolean } =  {
  ...DEFAULT_OPTIONS,
  longitude: true
};
export  function formatLatitude(value: number | null, opts?: LatLongFormatOptions): string {
  if (value === undefined || value === null) return null;

  switch(opts.pattern) {
    case 'DDMMSS':
      return formatToDDMMSS(value, { ...DEFAULT_LATITUDE_OPTIONS, ...opts });
    case 'DDMM':
      return formatToDDMM(value, { ...DEFAULT_LATITUDE_OPTIONS, ...opts });
    case 'DD':
    default:
      return formatToDD(value, { ...DEFAULT_LATITUDE_OPTIONS, ...opts });
  }
}

export function formatLongitude(value: number | null, opts?: LatLongFormatOptions): string {
  if (value === undefined || value === null) return null;

  switch(opts.pattern) {
    case 'DDMMSS':
      return formatToDDMMSS(value, { ...DEFAULT_LONGITUDE_OPTIONS, ...opts });
    case 'DDMM':
      return formatToDDMM(value, { ...DEFAULT_LONGITUDE_OPTIONS, ...opts });
    case 'DD':
    default:
      return formatToDD(value, { ...DEFAULT_LONGITUDE_OPTIONS, ...opts });
  }
}

function formatToDD(value: number, opts: LatLongFormatOptions & {longitude: boolean}): string {
  // opts.pattern === DD
  let negative = value < 0;
  if (negative) value *= -1;

  // Fix longitude when outside [-180, 180]
  if (opts.longitude) {
    while (value > 180) {
      value = (value - 180);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }
  // Fix latitude when outside [-90, 90]
  else {
    while (value > 90) {
      value = (value - 90);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }

  let degrees = roundFloat(value, opts.maxDecimals).toString();

  // Add sign
  let sign = negative ? '-' : '+';

  if (opts.placeholderChar) {
    if (opts.longitude) {
      if (value < 100) {
        degrees = opts.placeholderChar + degrees;
      }
    }
    else {
      sign += ' '; // Add space after the sign
    }
    if (value < 10) {
      degrees = opts.placeholderChar + degrees;
    }
    // Add decimal separator
    const integerLength = (opts.longitude && 3 || 2);
    if (degrees.length === integerLength) {
      degrees += '.';
    }
    // Add trailing placeholder chars
    while ((degrees.length < opts.maxDecimals + integerLength)) {
      degrees += opts.placeholderChar;
    }
  }
  return (opts.hideSign ? '' : sign) + degrees + '°';
}

function formatToDDMMSS(value: number, opts: LatLongFormatOptions & {longitude: boolean}): string {
  let negative = value < 0;
  if (negative) value *= -1;

  // Fix longitude when outside [-180, 180]
  if (opts.longitude) {
    while (value > 180) {
      value = (value - 180);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }
  // Fix latitude when outside [-90, 90]
  else {
    while (value > 90) {
      value = (value - 90);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }

  let degrees: number = Math.trunc(value);
  let minutes: number | string = Math.trunc((value - degrees) * 60);
  let seconds: number | string = roundFloat(((value - degrees) * 60 - minutes) * 60, opts.maxDecimals);

  while (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }
  while (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }
  const sign = opts.longitude ? (negative ? 'W' : 'E') : (negative ? 'S' : 'N');

  // Force spacer
  let prefix = '';
  if (opts.placeholderChar) {
    if (opts.longitude && degrees < 100) {
      prefix += opts.placeholderChar;
    }
    if (degrees < 10) {
      prefix += opts.placeholderChar;
    }

    if (minutes < 10) {
      minutes = opts.placeholderChar + minutes;
    }

    if (seconds < 10) {
      seconds = opts.placeholderChar + seconds;
    }
    else {
      seconds = seconds.toString(); // convert to string - required for the next while
    }
    if (opts.maxDecimals > 0) {
      // Add decimal separator
      if (seconds.length === 2) {
        seconds += '.';
      }
      // Add trailing placeholder chars
      while ((seconds.length < opts.maxDecimals + 3)) {
        seconds += opts.placeholderChar;
      }
    }
  }

  const output = prefix + degrees + '° ' + minutes + '\' ' + seconds + '"'
    + (opts.hideSign ? '' : ' ' + sign);

  // DEBUG
  //console.debug("formatToDDMMSS: " + value + " -> " + output);


  return output;
}

function formatToDDMM(value: number, opts: LatLongFormatOptions & {longitude: boolean}): string {
  let negative = value < 0;
  if (negative) value *= -1;

  // Fix longitude when outside [-180, 180]
  if (opts.longitude) {
    while (value > 180) {
      value = (value - 180);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }
  // Fix latitude when outside [-90, 90]
  else {
    while (value > 90) {
      value = (value - 90);
      negative = value < 0;
      if (negative) value *= -1;
    }
  }

  let degrees: number | string = Math.trunc(value);
  let minutes: number | string = roundFloat((value - degrees) * 60, opts.maxDecimals);
  while (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }
  const sign = opts.longitude ? (negative ? 'W' : 'E') : (negative ? 'S' : 'N');

  // Add placeholderChar
  let prefix = '';
  if (opts.placeholderChar) {
    if (opts.longitude && degrees < 100) {
      prefix += opts.placeholderChar;
    }
    if (degrees < 10) {
      prefix += opts.placeholderChar;
    }

    if (minutes < 10) {
      minutes = opts.placeholderChar + minutes;
    }
    else {
      minutes = minutes.toString(); // convert to string - required for the next while
    }
    if (opts.maxDecimals > 0) {
      // Add decimal separator
      if (minutes.length === 2) {
        minutes += '.';
      }
      // Add trailing placeholder chars
      while ((minutes.length < opts.maxDecimals + 3)) {
        minutes += opts.placeholderChar;
      }
    }
  }
  const output = prefix + degrees + '° ' + minutes + '\''
    + (opts.hideSign ? '' : ' ' + sign);

  // DEBUG
  //console.debug('formatToDDMM output:', output);

  return output;
}

// 36°57'9" N  = 36.9525000
// 10°4'21" W = -10.0725000
export function parseLatitudeOrLongitude(input: string, pattern: string, maxDecimals?: number, placeholderChar?: string): number | null {
  // Remove all placeholder (= trim on each parts)
  const inputFix = input.trim().replace(new RegExp('[ +' + (placeholderChar || DEFAULT_PLACEHOLDER_CHAR) + ']+', 'g'), '');
  //DEBUG console.debug("Parsing lat= " + inputFix);
  const parts = inputFix.split(/[^-\d\w.,]+/);
  let degrees = parseFloat(parts[0].replace(/,/g, '.'));
  if (isNaN(degrees)) {
    console.debug('parseLatitudeOrLongitude ' + input + ' -> Invalid degrees (NaN). Parts found:', parts);
    return NaN;
  }

  if (pattern === 'DD') return roundFloat(degrees, maxDecimals);

  const minutes = (pattern === 'DDMMSS' || pattern === 'DDMM') && parts[1] && parseFloat(parts[1].replace(/,/g, '.')) || 0;
  const seconds = (pattern === 'DDMMSS') && parts[2] && parseFloat(parts[2].replace(/,/g, '.')) || 0;
  const direction = ((pattern === 'DDMMSS') && parts[3]) || ((pattern === 'DDMM') && parts[2]) || undefined;
  const sign = (direction && (direction === 's' || direction === 'S' || direction === 'w' || direction === 'W')) ? -1 : 1;

  degrees = sign * (degrees + minutes / 60 + seconds / (60 * 60));

  return roundFloat(degrees, maxDecimals);
}

function roundFloat(input: number, maxDecimals?: number): number {
  if (maxDecimals > 0) {

    const powDecimal = Math.pow(10, maxDecimals);
    return Math.trunc(input * powDecimal + 0.5) / powDecimal;
  }
  // no decimals: round to integer
  else if (maxDecimals === 0) {
    return Math.trunc(input + 0.5);
  }
  return input;
}
