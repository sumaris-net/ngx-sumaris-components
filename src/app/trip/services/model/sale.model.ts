import {fromDateISOString, NOT_MINIFY_OPTIONS, toDateISOString} from "../../../core/core.module";
import {Person, ReferentialRef} from "../../../referential/referential.module";
import {Moment} from "moment/moment";
import {DataEntityAsObjectOptions, DataRootVesselEntity, IWithProductsEntity} from "./base.model";
import {Sample} from "./sample.model";
import {MeasurementUtils, MeasurementValuesUtils} from "./measurement.model";
import {Product} from "./product.model";
import {isNotEmptyArray} from "../../../shared/functions";


export class Sale extends DataRootVesselEntity<Sale> implements IWithProductsEntity<Sale> {

  static TYPENAME = 'SaleVO';

  static fromObject(source: any): Sale {
    if (!source) return null;
    const res = new Sale();
    res.fromObject(source);
    return res;
  }

  startDateTime: Moment;
  endDateTime: Moment;
  saleLocation: ReferentialRef;
  saleType: ReferentialRef;
  observedLocationId: number;
  tripId: number;
  measurementValues: { [key: string]: any };
  samples: Sample[];
  rankOrder: number;
  observers: Person[];
  products: Product[];

  constructor() {
    super();
    this.__typename = Sale.TYPENAME;
    this.saleLocation = new ReferentialRef();
    this.saleType = new ReferentialRef();
    this.measurementValues = {};
    this.samples = [];
    this.observers = [];
    this.products = [];
  }

  clone(): Sale {
    const target = new Sale();
    target.fromObject(this.asObject());
    return target;
  }

  copy(target: Sale) {
    target.fromObject(this);
  }


  fromObject(source: any): Sale {
    super.fromObject(source);
    this.startDateTime = fromDateISOString(source.startDateTime);
    this.endDateTime = fromDateISOString(source.endDateTime);
    source.saleLocation && this.saleLocation.fromObject(source.saleLocation);
    source.saleType && this.saleType.fromObject(source.saleType);
    this.rankOrder = source.rankOrder;
    this.tripId = source.tripId;
    this.observedLocationId = source.observedLocationId;
    this.samples = source.samples && source.samples.map(Sample.fromObject) || [];
    this.observers = source.observers && source.observers.map(Person.fromObject) || [];

    // Products (sale)
    this.products = source.products && source.products.map(Product.fromObject) || [];
    // Affect parent
    this.products.forEach(product => {
      product.parent = this;
    });

    if (source.measurementValues) {
      this.measurementValues = source.measurementValues;
    }
    // Convert measurement to map
    else if (source.measurements) {
      this.measurementValues = MeasurementUtils.toMeasurementValues(source.measurements);
    }

    return this;
  }

  asObject(options?: DataEntityAsObjectOptions): any {
    const target = super.asObject(options);
    target.startDateTime = toDateISOString(this.startDateTime);
    target.endDateTime = toDateISOString(this.endDateTime);
    target.saleLocation = this.saleLocation && this.saleLocation.asObject({...options, ...NOT_MINIFY_OPTIONS}) || undefined;
    target.saleType = this.saleType && this.saleType.asObject({...options, ...NOT_MINIFY_OPTIONS}) || undefined;
    target.samples = this.samples && this.samples.map(s => s.asObject(options)) || undefined;
    target.observers = this.observers && this.observers.map(o => o.asObject(options)) || undefined;
    target.measurementValues = MeasurementValuesUtils.asObject(this.measurementValues, options);

    // Products
    target.products = this.products && this.products.map(o => o.asObject(options)) || undefined;
    // Affect parent link
    if (isNotEmptyArray(target.products)) {
      target.products.forEach(product => {
        product.saleId = target.id;
        // todo product.landingId must also be set, but not here, see pod
        delete product.parent;
      });
    }

    return target;
  }

}
