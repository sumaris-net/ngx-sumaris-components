export const DEFAULT_MAX_DECIMALS = 2;

export  function formatDuration(value: number | null): string {
  if (value === undefined || value === null) return null;

  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return [
    hour.toString().padStart(3, '0'),
    minute.toString().padStart(2, '0')
  ].join(':');
}

// 111:11  = 111.18 (with maxDecimals=2)
export function parseDuration(input: string, maxDecimals?: number, placeholderChar?: string): number | null {

  let duration = input || '';
  // Make to remove placeholder chars
  while (duration.indexOf(placeholderChar) !== -1) {
    duration = duration.replace(placeholderChar, '');
  }

  const durationParts = duration.split(':');
  const hour = parseInt(durationParts[0] || '0');
  const minute = parseInt(durationParts[1] || '0');

  const value = hour + (minute + 0.5) / 60;
  return roundFloat(value, maxDecimals);
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
