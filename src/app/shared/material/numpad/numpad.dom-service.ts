import {
  ApplicationRef,
  ComponentFactoryResolver,
  ComponentRef,
  EmbeddedViewRef,
  Inject,
  Injectable,
  Injector,
  Optional,
  Type
} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {MatNumpadContainerComponent} from './numpad.container';
import {MatNumpadConfig} from './numpad.model';

@Injectable({
    providedIn: 'root'
})
export class MatNumpadDomService {

    private componentRef: ComponentRef<MatNumpadContainerComponent>;

    constructor(private cfr: ComponentFactoryResolver,
                private appRef: ApplicationRef,
                private injector: Injector,
                @Optional() @Inject(DOCUMENT) private document: any) {
    }

    appendNumpadToBody(numpadType: Type<MatNumpadContainerComponent>, config: MatNumpadConfig): void {
        this.componentRef = this.cfr.resolveComponentFactory(numpadType).create(this.injector);

        Object.keys(config).forEach(key => this.componentRef.instance[key] = config[key]);

        this.appRef.attachView(this.componentRef.hostView);

        const domElement: HTMLElement = (this.componentRef.hostView as EmbeddedViewRef<MatNumpadContainerComponent>)
            .rootNodes[0];

        this.document.body.appendChild(domElement);
    }

    destroyNumpad(): void {
        this.componentRef.destroy();
        this.appRef.detachView(this.componentRef.hostView);
    }
}
