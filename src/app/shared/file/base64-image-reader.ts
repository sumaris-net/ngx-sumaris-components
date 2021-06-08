import {isNilOrBlank} from '../functions';

export const IMAGE_DEFAULTS = {
  MAX_HEIGHT: 480,
  MAX_WIDTH: 640,
  THUMB_MAX_HEIGHT: 200,
  THUMB_MAX_WIDTH: 200
};

export declare interface Base64ImageResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  thumbnail?: boolean;
}

export class Base64ImageReader {

  constructor() {
  }

  async readFromBlob(file: any): Promise<string> {
    if (!file) throw new Error('Illegal argument: missing file');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', (event) => resolve(reader.result as string), false);
      reader.readAsDataURL(file);
    });
    return dataUrl;
  }

  async readAndResizeFromUrl(path: string, opts?: Base64ImageResizeOptions): Promise<string> {
    if (isNilOrBlank(path)) throw new Error('Illegal argument: missing path');

    // Create the temporary image element
    const img = document.createElement('img');

    // Need to avoid CORS error
    // (see https://stackoverflow.com/questions/22710627/tainted-canvases-may-not-be-exported)
    img.crossOrigin = 'anonymous';

    try {
      return await new Promise<string>((resolve, reject) => {
        img.addEventListener('load', this.createImageOnLoadResizeFn(resolve, reject, opts), false);
        img.addEventListener('error', reject);
        img.src = path;
      });
    }
    catch (err) {
      throw new Error(`Failed to load and resize image {${path}}`);
    }
    finally {
      img.remove();
    }
  }

  async readAndResizeFromBlob(file: any, opts: Base64ImageResizeOptions): Promise<string> {
    if (!file) throw new Error('Illegal argument: missing file');

    // Create the temporary image element
    const img = document.createElement('img');

    // Need to avoid CORS error
    // (see https://stackoverflow.com/questions/22710627/tainted-canvases-may-not-be-exported)
    img.crossOrigin = 'anonymous';

    try {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
          // Resize image
          img.onload = this.createImageOnLoadResizeFn(resolve, reject, opts);
          img.src = reader.result as string;
        }, false);
        reader.readAsDataURL(file);
      });
    } finally {
      img.remove();
    }
  }

  /* -- protected methods -- */

  protected createImageOnLoadResizeFn(resolve, reject, opts?: Base64ImageResizeOptions) {
    return function(event) {
      const
        maxWidth = (opts && opts.thumbnail ? IMAGE_DEFAULTS.THUMB_MAX_WIDTH : (opts && opts.maxWidth || IMAGE_DEFAULTS.MAX_WIDTH));
        const maxHeight = (opts && opts.thumbnail ? IMAGE_DEFAULTS.THUMB_MAX_HEIGHT : (opts && opts.maxHeight || IMAGE_DEFAULTS.MAX_HEIGHT));
      let width = event.target.width;
        let height = event.target.height;

      const canvas = document.createElement('canvas');
      let ctx;

      try {
        // Thumbnail: resize and crop (to the expected size)
        if (opts && opts.thumbnail) {

          // landscape
          if (width > height) {
            width *= maxHeight / height;
            height = maxHeight;
          }

          // portrait
          else {
            height *= maxWidth / width;
            width = maxWidth;
          }
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          ctx = canvas.getContext('2d');
          const xoffset = Math.trunc((maxWidth - width) / 2 + 0.5);
          const yoffset = Math.trunc((maxHeight - height) / 2 + 0.5);
          ctx.drawImage(event.target,
            xoffset, // x1
            yoffset, // y1
            maxWidth + -2 * xoffset, // x2
            maxHeight + -2 * yoffset // y2
          );
        }

        // Resize, but keep the full image
        else {

          // landscape
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          }

          // portrait
          else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext('2d');

          // Resize the whole image
          ctx.drawImage(event.target, 0, 0, canvas.width, canvas.height);
        }

        // Get image content as data URL
        const base64 = canvas.toDataURL();
        resolve(base64);
      }
      catch (err) {
        reject(err);
      }
      finally {
        canvas.remove();
      }

    };
  }
}
