import {
  AfterViewInit,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from "@angular/core";
import {ModalController} from "@ionic/angular";
import {Subscription} from "rxjs";
import {AppFormUtils} from "../../core/form/form.utils";
import {ProductSaleForm} from "./product-sale.form";
import {Product} from "../services/model/product.model";
import {PmfmStrategy} from "../../referential/services/model";

@Component({
  selector: 'app-product-sale-modal',
  templateUrl: './product-sale.modal.html'
})
export class ProductSaleModal implements OnInit, OnDestroy, AfterViewInit {

  loading = false;
  subscription = new Subscription();

  @ViewChild('productSaleForm', {static: true}) productSaleForm: ProductSaleForm;

  @Input() product: Product;
  @Input() productSalePmfms: PmfmStrategy[];

  get disabled() {
    return this.productSaleForm.disabled;
  }

  get enabled() {
    return this.productSaleForm.enabled;
  }

  get valid() {
    return this.productSaleForm.valid;
  }


  constructor(
    protected viewCtrl: ModalController
  ) {

  }

  ngOnInit(): void {
    this.enable();
  }

  ngAfterViewInit(): void {

    setTimeout(() => {
      this.productSaleForm.setValue(Product.fromObject(this.product));
    });

  }

  async onSave(event: any): Promise<any> {

    // Avoid multiple call
    if (this.disabled) return;

    await AppFormUtils.waitWhilePending(this.productSaleForm);

    if (this.productSaleForm.invalid) {
      AppFormUtils.logFormErrors(this.productSaleForm.form);
      return;
    }

    this.loading = true;

    try {
      const value = this.productSaleForm.value;
      this.disable();
      await this.viewCtrl.dismiss(value);
      this.productSaleForm.error = null;
    } catch (err) {
      console.error(err);
      this.productSaleForm.error = err && err.message || err;
      this.enable();
      this.loading = false;
    }
  }

  disable() {
    this.productSaleForm.disable();
  }

  enable() {
    this.productSaleForm.enable();
  }

  cancel() {
    this.viewCtrl.dismiss();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}