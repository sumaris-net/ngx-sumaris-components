import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {MenuItem} from './menu.model';

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  private readonly _toggledSubject = new Subject<void>();
  private readonly _visibleSubject = new Subject<boolean>();

  get menuToggled$(): Observable<void> {
    return this._toggledSubject.asObservable();
  }

  get menuVisible$(): Observable<boolean> {
    return this._visibleSubject.asObservable();
  }

  toggleMenu() {
    this._toggledSubject.next();
  }

  menuVisible(value: boolean) {
    this._visibleSubject.next(value);
  }

}
