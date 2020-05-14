import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {AppForm, AppFormUtils, FormArrayHelper} from "../../core/core.module";
import {AbstractControl, FormArray, FormBuilder, FormGroup} from "@angular/forms";
import {UsageMode} from "../../core/services/model";
import {isNotEmptyArray} from "../../shared/functions";
import {DateAdapter} from "@angular/material";
import {Moment} from "moment";
import {PacketValidatorService} from "../services/validator/packet.validator";
import {LocalSettingsService} from "../../core/services/local-settings.service";
import {Packet} from "../services/model/packet.model";
import {ReferentialRefService} from "../../referential/services/referential-ref.service";
import {Subscription} from "rxjs";
import {fillRankOrder, PmfmStrategy} from "../services/model/base.model";
import {SaleProduct, SaleProductUtils} from "../services/model/sale-product.model";

@Component({
  selector: 'app-packet-sale-form',
  templateUrl: './packet-sale.form.html',
  styleUrls: ['./packet-sale.form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PacketSaleForm extends AppForm<Packet> implements OnInit, OnDestroy {

  computing = false;
  salesHelper: FormArrayHelper<SaleProduct>;
  salesFocusIndex = -1;
  private saleSubscription = new Subscription();

  get saleFormArray(): FormArray {
    return this.form.controls.saleProducts as FormArray;
  }

  mobile: boolean;
  private _packet: Packet;

  @Input() showError = true;
  @Input() usageMode: UsageMode;
  @Input() packetSalePmfms: PmfmStrategy[];

  get isOnFieldMode(): boolean {
    return this.usageMode ? this.usageMode === 'FIELD' : this.settings.isUsageMode('FIELD');
  }

  get value(): any {
    const json = this.form.value;

    // Update packets sales if needed
    fillRankOrder(json.saleProducts);

    // Convert aggregated products sales to products
    json.saleProducts = json.saleProducts && SaleProductUtils.aggregatedSaleProductsToProducts(this._packet, json.saleProducts, this.packetSalePmfms);

    return json;
  }

  constructor(
    protected dateAdapter: DateAdapter<Moment>,
    protected validatorService: PacketValidatorService,
    protected settings: LocalSettingsService,
    protected cd: ChangeDetectorRef,
    protected formBuilder: FormBuilder,
    protected referentialRefService: ReferentialRefService
  ) {
    super(dateAdapter, validatorService.getFormGroup(undefined, {withSaleProducts: true}), settings);
  }

  ngOnInit() {
    super.ngOnInit();

    this.initSalesHelper();

    this.usageMode = this.usageMode || this.settings.usageMode;

    // Combo: taxonGroup
    this.registerAutocompleteField('taxonGroup', {});

    // Combo: sale types
    this.registerAutocompleteField('saleType', {
      service: this.referentialRefService,
      attributes: ['name'],
      filter: {
        entityName: 'SaleType'
      }
    });

  }

  setValue(data: Packet, opts?: { emitEvent?: boolean; onlySelf?: boolean }) {

    if (!data) return;
    this._packet = data;

    // Initialize product sales by converting products to aggregated sale products
    const aggregatedSaleProducts = isNotEmptyArray(data.saleProducts) ? SaleProductUtils.productsToAggregatedSaleProduct(data.saleProducts, this.packetSalePmfms) : [null];
    this.salesHelper.resize(Math.max(1, aggregatedSaleProducts.length));

    // Set value
    super.setValue(data, opts);

    // Then patch saleProducts to keep this._packet safe
    this.form.patchValue({saleProducts: aggregatedSaleProducts});

    // update saleFromArray validators
    this.validatorService.updateFormGroup(this.form, {withSaleProducts: true});

    this.computeAllPrices();

    this.initSubscription();
  }

  private initSubscription() {

    // clear and re-create
    this.saleSubscription.unsubscribe();
    this.saleSubscription = new Subscription();

    // add subscription on each sale form
    for (const saleControl of this.saleFormArray.controls) {
      this.saleSubscription.add(saleControl.valueChanges.subscribe(() => {
        this.computePrices(this.asFormGroup(saleControl).controls);
        saleControl.markAsPristine();
      }));
    }

  }

  private computeAllPrices() {
    for (const sale of this.saleFormArray.controls as FormGroup[] || []) {
      this.computePrices(sale.controls);
    }
  }

  computePrices(controls: { [key: string]: AbstractControl }) {

    if (this.computing)
      return;

    try {
      this.computing = true;

      // with packet subgroupCount (should be < whole packet number)
      const subgroupCount = controls.subgroupCount.value;
      if (subgroupCount) {
        if (AppFormUtils.isControlHasInput(controls, 'averagePackagingPrice')) {
          // compute total price
          AppFormUtils.setCalculatedValue(controls, 'totalPrice', controls.averagePackagingPrice.value * subgroupCount);

        } else if (AppFormUtils.isControlHasInput(controls, 'totalPrice')) {
          // compute average packaging price
          AppFormUtils.setCalculatedValue(controls, 'averagePackagingPrice', controls.totalPrice.value / subgroupCount);

        }
        // compute weigh (always calculated)
        AppFormUtils.setCalculatedValue(controls, 'weight', subgroupCount * this.form.controls.weight.value / this.form.controls.number.value);

      } else {
        // reset all
        AppFormUtils.resetCalculatedValue(controls, 'averagePackagingPrice');
        AppFormUtils.resetCalculatedValue(controls, 'totalPrice');
        AppFormUtils.resetCalculatedValue(controls, 'weight');
      }

    } finally {
      this.computing = false;
    }

  }

  private initSalesHelper() {
    this.salesHelper = new FormArrayHelper<SaleProduct>(
      this.formBuilder,
      this.form,
      'saleProducts',
      (saleProduct) => this.validatorService.getSaleProductControl(saleProduct),
      SaleProductUtils.isSaleProductEquals,
      SaleProductUtils.isSaleProductEmpty,
      {
        allowEmptyArray: true
      }
    );
    if (this.salesHelper.size() === 0) {
      // add at least one sale
      this.salesHelper.resize(1);
    }
    this.markForCheck();

  }

  asFormGroup(control): FormGroup {
    return control;
  }

  addSale() {
    // todo create new aggregated sale product from form value which is the packet
    // const newSaleProduct = SaleProductUtils.newAggregatedSaleProduct(this._packet, this.packetSalePmfms);
    // this.salesHelper.add(newSaleProduct);
    this.salesHelper.add();
    this.initSubscription();
    if (!this.mobile) {
      this.salesFocusIndex = this.salesHelper.size() - 1;
    }
  }

  removeSale(index: number) {
    this.salesHelper.removeAt(index);
    this.initSubscription();
  }

  protected markForCheck() {
    this.cd.markForCheck();
  }

  ngOnDestroy() {
    this.saleSubscription.unsubscribe();
    super.ngOnDestroy();
  }
}