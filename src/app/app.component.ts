import {Component, Inject} from '@angular/core';
import {ConfigService} from './core/services/config.service';
import {DOCUMENT} from "@angular/common";
import {Configuration} from "./core/services/model/config.model";
import {PlatformService} from "./core/services/platform.service";
import {throttleTime} from "rxjs/operators";
import {FormFieldDefinition} from "./shared/form/field.model";
import {getColorContrast, getColorShade, getColorTint, hexToRgbArray, mixHex} from "./shared/graph/colors.utils";
import {AccountService} from "./core/services/account.service";
import {LocalSettingsService} from "./core/services/local-settings.service";
import {MatIconRegistry} from "@angular/material/icon";
import {DomSanitizer} from "@angular/platform-browser";
import {isNotNil, joinPropertiesPath} from "./shared/functions";
import {Department} from "./core/services/model/department.model";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  logo: String;
  appName: String;

  constructor(
    @Inject(DOCUMENT) private _document: HTMLDocument,
    private platform: PlatformService,
    private accountService: AccountService,
    private configService: ConfigService,
    private settings: LocalSettingsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {

    this.start();
  }

  async start() {
    console.info('[app] Starting...');

    await this.platform.start();

    // Listen for config changed
    this.configService.config.subscribe(config => this.onConfigChanged(config));

    // Add additional account fields
    this.addAccountFields();

    this.addCustomSVGIcons();

    console.info('[app] Starting [OK]');
  }

  onActivate(event) {
    // Make sure to scroll on top before changing state
    // See https://stackoverflow.com/questions/48048299/angular-5-scroll-to-top-on-every-route-click
    const scrollToTop = window.setInterval(() => {
      const pos = window.pageYOffset;
      if (pos > 0) {
        window.scrollTo(0, pos - 20); // how far to scroll on each step
      } else {
        window.clearInterval(scrollToTop);
      }
    }, 16);
  }

  protected onConfigChanged(config: Configuration) {

    this.logo = config.smallLogo || config.largeLogo;
    this.appName = config.label;

    // Set document title
    const title = isNotNil(config.name) ? `${config.label} - ${config.name}` : config.label;
    this._document.getElementById('appTitle').textContent = title;

    // Set document favicon
    const favicon = config.properties && config.properties["sumaris.favicon"];
    if (isNotNil(favicon)) {
      this._document.getElementById('appFavicon').setAttribute('href', favicon);
    }

    if (config.properties) {
      this.updateTheme({
        colors: {
          primary: config.properties["sumaris.color.primary"],
          secondary: config.properties["sumaris.color.secondary"],
          tertiary: config.properties["sumaris.color.tertiary"],
          success: config.properties["sumaris.color.success"],
          warning: config.properties["sumaris.color.warning"],
          accent: config.properties["sumaris.color.accent"],
          danger: config.properties["sumaris.color.danger"]
        }
      });
    }
  }

  protected updateTheme(options: { colors?: { [color: string]: string; } }) {
    if (!options) return;


    // Settings colors
    if (options.colors) {
      console.info("[app] Changing theme colors ", options);

      const style =   document.documentElement.style;

      // Add 100 & 900 color for primary and secondary color
      ['primary', 'secondary'].forEach(colorName => {
        const color = options.colors[colorName];
        options.colors[colorName + '100'] = color && mixHex('#ffffff', color, 10) || undefined;
        options.colors[colorName + '900'] = color && mixHex('#000000', color, 12) || undefined;
      });

      Object.getOwnPropertyNames(options.colors).forEach(colorName => {

        // Remove existing value
        style.removeProperty(`--ion-color-${colorName}`);
        style.removeProperty(`--ion-color-${colorName}-rgb`);
        style.removeProperty(`--ion-color-${colorName}-contrast`);
        style.removeProperty(`--ion-color-${colorName}-contrast-rgb`);
        style.removeProperty(`--ion-color-${colorName}-shade`);
        style.removeProperty(`--ion-color-${colorName}-tint`);

        // Set new value, if any
        const color = options.colors[colorName];
        if (isNotNil(color)) {
          // Base color
          style.setProperty(`--ion-color-${colorName}`, color);
          style.setProperty(`--ion-color-${colorName}-rgb`, hexToRgbArray(color).join(', '));

          // Contrast color
          const contrastColor = getColorContrast(color, true);
          style.setProperty(`--ion-color-${colorName}-contrast`, contrastColor);
          style.setProperty(`--ion-color-${colorName}-contrast-rgb`, hexToRgbArray(contrastColor).join(', '));

          // Shade color
          style.setProperty(`--ion-color-${colorName}-shade`, getColorShade(color));

          // Tint color
          style.setProperty(`--ion-color-${colorName}-tint`, getColorTint(color));
        }
      });
    }
  }

  protected addAccountFields() {

    console.debug("[app] Add additional account fields...");

    const attributes = this.settings.getFieldDisplayAttributes('department');
    const departmentDefinition = <FormFieldDefinition>{
      key: 'department',
      label: 'USER.DEPARTMENT.TITLE',
      type: 'entity',
      autocomplete: {
        items: [
          Department.fromObject({id: 1, label: 'E-IS', name: 'Environmental Information Systems'}),
          Department.fromObject({id: 2, label: 'UNK', name: 'Other'})
        ],
        filter: {entityName: 'Department'},
        displayWith: (value) => value && joinPropertiesPath(value, attributes),
        attributes: attributes,
        columnSizes: attributes.map(attr => attr === 'label' ? 3 : undefined)
      },
      extra: {
        registration: {
          required: true
        },
        account: {
          required: true,
          disable: true
        }
      }
    };

    // Add account field: department
    this.accountService.registerAdditionalField(departmentDefinition);

    // When settings changed
    this.settings.onChange
      .pipe(throttleTime(400))
      .subscribe(() => {
        // Update the display fn
        const attributes = this.settings.getFieldDisplayAttributes('department');
        departmentDefinition.autocomplete.attributes = attributes;
        departmentDefinition.autocomplete.displayWith = (value) => value && joinPropertiesPath(value, attributes) || undefined;
      });
  }

  protected addCustomSVGIcons() {
    this.matIconRegistry.addSvgIcon(
      "fish",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/icons/fish.svg")
    );
  }
}

