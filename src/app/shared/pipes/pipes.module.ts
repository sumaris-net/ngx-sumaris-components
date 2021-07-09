import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {IonicModule} from '@ionic/angular';
import {DateFormatPipe} from './date-format.pipe';
import {DateDiffDurationPipe} from './date-diff-duration.pipe';
import {DateFromNowPipe} from './date-from-now.pipe';
import {LatitudeFormatPipe, LatLongFormatPipe, LongitudeFormatPipe} from './latlong-format.pipe';
import {NumberFormatPipe} from './number-format.pipe';
import {HighlightPipe} from './highlight.pipe';
import {FileSizePipe} from './file-size.pipe';
import {DurationPipe} from './duration.pipe';
import {EvenPipe, MathAbsPipe, OddPipe} from './math.pipes';
import {ArrayFilterPipe, ArrayFirstPipe, ArrayIncludesPipe, ArrayLengthPipe, ArrayPluckPipe, EmptyArrayPipe, NotEmptyArrayPipe} from './arrays.pipe';
import {MapGetPipe, MapKeysPipe, MapValuesPipe} from './maps.pipe';
import {IsNilOrBlankPipe, IsNotNilOrBlankPipe} from './string.pipes';
import {TranslatablePipe, TranslateContextPipe} from './translate-context.pipe';
import {PropertyGetPipe} from './properties.pipe';
import {NgInitDirective} from './ng-init.pipe';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule
  ],
  declarations: [
    PropertyGetPipe,
    DateFormatPipe,
    DateDiffDurationPipe,
    DurationPipe,
    DateFromNowPipe,
    LatLongFormatPipe,
    LatitudeFormatPipe,
    LongitudeFormatPipe,
    HighlightPipe,
    NumberFormatPipe,
    FileSizePipe,
    MathAbsPipe,
    OddPipe,
    EvenPipe,
    NotEmptyArrayPipe,
    EmptyArrayPipe,
    ArrayLengthPipe,
    ArrayFirstPipe,
    ArrayPluckPipe,
    ArrayIncludesPipe,
    ArrayFilterPipe,
    MapGetPipe,
    MapKeysPipe,
    MapValuesPipe,
    IsNilOrBlankPipe,
    IsNotNilOrBlankPipe,
    TranslateContextPipe,
    TranslatablePipe,
    NgInitDirective
  ],
  exports: [
    PropertyGetPipe,
    DateFormatPipe,
    DateFromNowPipe,
    DateDiffDurationPipe,
    DurationPipe,
    LatLongFormatPipe,
    LatitudeFormatPipe,
    LongitudeFormatPipe,
    HighlightPipe,
    NumberFormatPipe,
    FileSizePipe,
    MathAbsPipe,
    OddPipe,
    EvenPipe,
    NotEmptyArrayPipe,
    EmptyArrayPipe,
    ArrayLengthPipe,
    ArrayFirstPipe,
    ArrayPluckPipe,
    MapGetPipe,
    MapKeysPipe,
    MapValuesPipe,
    IsNilOrBlankPipe,
    IsNotNilOrBlankPipe,
    ArrayIncludesPipe,
    ArrayFilterPipe,
    TranslateContextPipe,
    TranslatablePipe,
    NgInitDirective
  ]
})
export class SharedPipesModule {

}
