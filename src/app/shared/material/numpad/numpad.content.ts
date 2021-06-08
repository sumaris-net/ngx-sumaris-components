import {Component, Input} from '@angular/core';

@Component({
    selector: 'mat-numpad-content',
    templateUrl: './numpad.content.html',
})
export class MatNumpadContent {
    @Input() appendToInput: boolean;
    @Input() inputElement: any;
}
