import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input, OnDestroy,
  OnInit, Optional,
  Output,
  ViewChild
} from '@angular/core';
import {ProgressBarService, ProgressMode} from '../services/progress-bar.service';
import {Router} from '@angular/router';
import {IonRouterOutlet, IonSearchbar} from '@ionic/angular';
import {isNotNil, isNotNilOrBlank, toBoolean} from '../functions';
import {debounceTime, distinctUntilChanged, startWith, tap} from 'rxjs/operators';
import {Observable} from 'rxjs';
import {HammerTapEvent} from '../gesture/hammer.utils';
import {HAMMER_PRESS_TIME} from '../gesture/gesture-config';
import {PredefinedColors} from '@ionic/core';

export abstract class ToolbarToken {
  abstract onBackClick: Observable<Event>;
  abstract doBackClick(event: Event);
  abstract goBack(): Promise<void>;
  abstract canGoBack: boolean;
}

@Component({
  selector: 'app-toolbar',
  templateUrl: 'toolbar.html',
  styleUrls: ['./toolbar.scss'],
  providers: [
    {provide: ToolbarToken, useExisting: ToolbarComponent}
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent implements ToolbarToken, OnInit, OnDestroy {

  private _closeTapCount = 0;
  private _validateTapCount = 0;
  private _defaultBackHref: string;
  private _backHref: string;

  @Input() title: String = '';

  @Input() color: PredefinedColors = 'primary';

  @Input()
  class = '';

  @Input() set backHref(value: string) {
    if (value !== this._backHref) {
      this._backHref = value;
      this.canGoBack = this.canGoBack || isNotNil(value);
      this.cd.markForCheck();
    }
  }

  get backHref(): string {
    return this._backHref;
  }

  @Input() set defaultBackHref(value: string) {
    if (value !== this._defaultBackHref) {
      this._defaultBackHref = value;
      this.canGoBack = this.canGoBack || isNotNil(value);
      this.cd.markForCheck();
    }
  }

  get defaultBackHref(): string {
    return this._defaultBackHref;
  }

  @Input()
  hasValidate = false;

  @Input()
  hasClose = false;

  @Input()
  hasSearch: boolean;

  @Input()
  canGoBack: boolean;

  @Input()
  canShowMenu = true;

  @Output()
  onValidate = new EventEmitter<Event>();

  @Output()
  onClose = new EventEmitter<Event>();

  @Output()
  onValidateAndClose = new EventEmitter<Event>();

  @Output()
  onBackClick = new EventEmitter<Event>();

  @Output()
  onSearch = new EventEmitter<CustomEvent>();

  progressBarMode$: Observable<ProgressMode>;

  showSearchBar = false;

  @ViewChild('searchbar', {static: true}) searchbar: IonSearchbar;

  constructor(
    private router: Router,
    private routerOutlet: IonRouterOutlet,
    private cd: ChangeDetectorRef,
    @Optional() progressBarService: ProgressBarService
  ) {

    // Listen progress bar service mode
    if (progressBarService) {
      this.progressBarMode$ = progressBarService.onProgressChanged
        .pipe(
          startWith<ProgressMode, ProgressMode>('none' as ProgressMode),
          tap((mode) => '[toolbar] Updating progressBarMode: ' + mode),
          debounceTime(100), // wait 100ms, to group changes
          distinctUntilChanged()
        );
    }
  }

  ngOnInit() {
    this.hasValidate = toBoolean(this.hasValidate, this.onValidate.observers.length > 0);
    this.canGoBack = toBoolean(this.canGoBack, this.routerOutlet.canGoBack()
      || isNotNilOrBlank(this._backHref)
      || isNotNilOrBlank(this._defaultBackHref));
    this.hasSearch = toBoolean(this.hasSearch, this.onSearch.observers.length > 0);
  }

  ngOnDestroy() {
    this.onBackClick.complete();
    this.onBackClick.unsubscribe();
    this.onValidate.complete();
    this.onValidate.unsubscribe();
    this.onClose.complete();
    this.onClose.unsubscribe();
    this.onValidateAndClose.complete();
    this.onValidateAndClose.unsubscribe();
    this.onSearch.complete();
    this.onSearch.unsubscribe();
  }

  async toggleSearchBar() {
    this.showSearchBar = !this.showSearchBar;
    if (this.showSearchBar && this.searchbar) {
      setTimeout(async () => {
        await this.searchbar.setFocus();
      }, 300);
    }
  }

  doBackClick(event: Event) {

    this.onBackClick.emit(event);

    // Stop propagation, if need (can be cancelled by onBackClick observers)
    if (event.defaultPrevented) return;

    // Execute the back action
    this.goBack();
  }

  async goBack(): Promise<void> {
    console.debug('[toolbar] calling goBack()');
    if (this._backHref) {
      await this.router.navigateByUrl(this._backHref);
    }
    else if (this.routerOutlet.canGoBack()) {
      await this.routerOutlet.pop();
    }
    else if (this._defaultBackHref) {
      await this.router.navigateByUrl(this._defaultBackHref);
    }
    else {
      console.error('[toolbar] Cannot go back. Missing attribute \'defaultBackHref\' or \'backHref\'');
    }
  }

  tapClose(event: HammerTapEvent) {
    // DEV only
    // console.debug("[toolbar] tapClose", event.tapCount);
    if (this._validateTapCount > 0) return;

    // Distinguish simple and double tap
    this._closeTapCount = event.tapCount;
    setTimeout(() => {
      // Event is obsolete (a new tap event occur)
      if (event.tapCount < this._closeTapCount) {
        // Ignore event
      }

      // If event still the last tap event: process it
      else {
        this.onClose.emit(event.srcEvent || event);

        // Reset tab count
        this._closeTapCount = 0;
      }
    }, 500);
  }

  tapValidate(event: HammerTapEvent) {
    // DEV only
    //console.debug("[toolbar] tapValidate", event.tapCount);

    if (!this.onValidateAndClose.observers.length) {
      this.onValidate.emit(event.srcEvent || event);
    }

    // Distinguish simple and double tap
    else {
      this._validateTapCount = event.tapCount;
      setTimeout(() => {
        // Event is obsolete (a new tap event occur)
        if (event.tapCount < this._validateTapCount) {
          // Ignore event
        }

        // If event still the last tap event: process it
        else {
          if (this._validateTapCount === 1) {
            this.onValidate.emit(event.srcEvent || event);
          }
          else if (this._validateTapCount >= 2) {
            this.onValidateAndClose.emit(event.srcEvent || event);
          }

          // Reset tab count
          this._validateTapCount = 0;
        }
      }, HAMMER_PRESS_TIME+10);
    }
  }
}
