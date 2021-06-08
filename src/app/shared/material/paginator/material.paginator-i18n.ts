
import { TranslateService } from '@ngx-translate/core';
import {MatPaginatorIntl} from '@angular/material/paginator';
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class MatPaginatorI18n extends MatPaginatorIntl {
  itemsPerPageLabel = 'Items per page';
  nextPageLabel     = 'Next page';
  previousPageLabel = 'Previous page';
  getRangeLabel = function(page, pageSize, length) {
    const of = this.translate ? this.translate.instant('COMMON.PAGINATOR.OF') : 'of';
    if (length === 0 || pageSize === 0) {
      return '0 ' + of + ' ' + length;
    }
    length = Math.max(length, 0);
    const startIndex = page * pageSize;
    // If the start index exceeds the list length, do not try and fix the end index to the end.
    const endIndex = startIndex < length ?
      Math.min(startIndex + pageSize, length) :
    startIndex + pageSize;
    return startIndex + 1 + ' - ' + endIndex + ' ' + of + ' ' + length;
  };

  constructor(private translate: TranslateService) {
    super();
    this.translate = translate;

    translate.onLangChange.subscribe(() => this.translateLabels());

    this.translateLabels();
  }

  private translateLabels() {
    //console.debug("[i18n] Update pagination translations");
    this.itemsPerPageLabel = this.translate.instant('COMMON.PAGINATOR.ITEMS_PER_PAGE');
    this.nextPageLabel = this.translate.instant('COMMON.PAGINATOR.NEXT_PAGE');
    this.previousPageLabel = this.translate.instant('COMMON.PAGINATOR.PREVIOUS_PAGE');
  }

}
