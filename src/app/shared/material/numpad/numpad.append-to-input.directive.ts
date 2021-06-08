import {AfterViewInit, Directive, ElementRef, HostListener, Input, Renderer2} from '@angular/core';

type TimepickerDirectionY = 'top' | 'center' | 'bottom';
type TimepickerDirectionX = 'start' | 'center' | 'end';

@Directive({
    selector: '[appendNumpadToInput]'
})
export class AppendToInputDirective implements AfterViewInit {

    @Input('appendNumpadToInput') inputElement: any;

    private _directionY: TimepickerDirectionY;
    private _directionX: TimepickerDirectionX;
    private _inputCords: ClientRect;
    private readonly element: HTMLElement;

    constructor(elementRef: ElementRef<HTMLElement>,
                private renderer: Renderer2) {
        this.element = elementRef.nativeElement;
    }

    private get inputCords(): ClientRect {
        return this.inputElement.getBoundingClientRect();
    }

    private get directionY(): TimepickerDirectionY {
        const height = this.element.offsetHeight;
        const {bottom, top} = this._inputCords;
        const isElementFit = (window && window.innerHeight) - bottom < height;
        const isTop = isElementFit && top > height;
        const isCenter = isElementFit && top < height;

        if (isTop) {
            return 'top';
        } else if (isCenter) {
            return 'center';
        }
        return 'bottom';
    }

  private get directionX(): TimepickerDirectionX {
    const width = this.element.offsetWidth;
    const {left, right} = this._inputCords;
    const isElementFit = (window && window.innerWidth) - left < width;
    const isEnd = isElementFit && right > width;
    const isCenter = isElementFit && right < width;

    if (isEnd) {
      return 'end';
    } else if (isCenter) {
      return 'center';
    }
    return 'start';
  }

    ngAfterViewInit(): void {
        this._inputCords = this.inputCords;
        this._directionY = this.directionY;
        this._directionX = this.directionX;

        this.append();
    }

    @HostListener('window:scroll')
    changePosition(): void {
      const {left, right, bottom, top} = this.inputCords;
      const x = this.defineElementYByDirection(left, right);
      const y = this.defineElementYByDirection(top, bottom);
      this.setStyle('left', `${x}px`);
      this.setStyle('top', `${y}px`);
    }

    private append(): void {
        const {left, right, bottom, top} = this._inputCords;

        const x = this.defineElementXByDirection(left, right);
        const y = this.defineElementYByDirection(top, bottom);

        this.setStyle('position', 'fixed');
        this.setStyle('left', `${x}px`);
        this.setStyle('top', `${y}px`);
    }

    private setStyle(style: string, value: string): void {
        this.renderer.setStyle(this.element, style, value);
    }

    private defineElementYByDirection(inputTop: number, inputBottom: number): number {
        if (this._directionY === 'top') {
            return inputTop - this.element.offsetHeight;
        } else if (this._directionY === 'center') {
            return inputTop - (this.element.offsetHeight / 2);
        }
        return inputBottom;
    }

    private defineElementXByDirection(inputLeft: number, inputRight: number) {
      // DEBUG
      //console.log("defineElementXByDirection ", inputLeft, inputRight);

      if (this._directionX === 'end') {
        return inputRight - this.element.offsetWidth;
      } else if (this._directionX === 'center') {
        return inputRight - (this.element.offsetWidth / 2);
      }
      return inputLeft;
    }
}
