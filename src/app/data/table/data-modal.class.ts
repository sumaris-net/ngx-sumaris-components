import {IModalDetailOptions} from "../../core/table/table.class";
import {Observable} from "rxjs";
import {Entity} from "../../core/services/model/entity.model";
import {UsageMode} from "../../core/services/model/settings.model";
import {IPmfm} from "../../referential/services/model/pmfm.model";

export interface IDataEntityModalOptions<T extends Entity<T>> extends IModalDetailOptions<T> {
  // Program (or PMFMs, to avoid loading PMFMs by program)
  programLabel: string;
  acquisitionLevel: string;
  pmfms: Observable<IPmfm[]> | IPmfm[];

  // UI options
  usageMode: UsageMode;
}
