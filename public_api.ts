// Environment

export * from './src/environments/environment.class';

// Shared
export * from './src/app/shared/constants';
export * from './src/app/shared/shared.module';
export {SharedRoutingModule} from './src/app/shared/shared-routing.module';

// Shared material
export * from './src/app/shared/material/material.module';
export * from './src/app/shared/material/boolean/boolean.module';
export {MatBooleanField} from './src/app/shared/material/boolean/material.boolean';
export * from './src/app/shared/material/autocomplete/autocomplete.module';
export {MatAutocompleteField, MatAutocompleteFieldConfig, MatAutocompleteConfigHolder, MatAutocompleteFieldAddOptions} from './src/app/shared/material/autocomplete/material.autocomplete';
export * from './src/app/shared/material/chips/chips.module';
export * from './src/app/shared/material/chips/material.chips';
export * from './src/app/shared/material/material.animations';
export * from './src/app/shared/material/paginator/material.paginator-i18n';
export * from './src/app/shared/material/stepper/material.stepper-i18n';
export {MatDateShort} from './src/app/shared/material/datetime/material.dateshort';
export {MatDateTime} from './src/app/shared/material/datetime/material.datetime';
export {MatDate} from './src/app/shared/material/datetime/material.date';
export {MatLatLongField} from './src/app/shared/material/latlong/material.latlong';
export * from './src/app/shared/material/latlong/material.latlong.module';

// Shared components
export * from './src/app/shared/inputs';
export {AppFormField} from './src/app/shared/form/field.component';
export * from './src/app/shared/form/loading-spinner';
export * from './src/app/shared/form/field.model';
export * from './src/app/shared/toolbar/toolbar';
export * from './src/app/shared/toolbar/modal-toolbar';
export * from './src/app/shared/interceptors/progess.interceptor';
export * from './src/app/shared/toasts';
export * from './src/app/shared/help/help.modal';


// Shared directives
export * from './src/app/shared/directives/directives.module';
export * from './src/app/shared/directives/autofocus.directive';

// Shared pipes
export * from './src/app/shared/pipes/pipes.module';
export * from './src/app/shared/pipes/date-format.pipe';
export * from './src/app/shared/pipes/date-from-now.pipe';
export * from './src/app/shared/pipes/date-diff-duration.pipe';
export * from './src/app/shared/pipes/latlong-format.pipe';
export * from './src/app/shared/pipes/highlight.pipe';
export * from './src/app/shared/pipes/number-format.pipe';
export * from './src/app/shared/pipes/properties.pipe';
export * from './src/app/shared/pipes/duration.pipe';

// Shared services
export * from './src/app/shared/audio/audio';
export * from './src/app/shared/file/file.service';
export * from './src/app/shared/services/entity-service.class';
export * from './src/app/shared/services/memory-entity-service.class';
export * from './src/app/shared/services/progress-bar.service';
export * from './src/app/shared/services/translate-context.service';
export * from './src/app/shared/services/job.utils';

// Shared other
export * from './src/app/shared/types';
export * from './src/app/shared/dates';
export * from './src/app/shared/functions';
export * from './src/app/shared/observables';
export * from './src/app/shared/events';
export * from './src/app/shared/alerts';
export * from './src/app/shared/hotkeys/shared-hotkeys.module';
export * from './src/app/shared/hotkeys/hotkeys.service';
export * from './src/app/shared/hotkeys/dialog/hotkeys-dialog.component';
export {Color, ColorName, ColorScale, ColorScaleLegend, ColorScaleOptions, ColorGradientOptions, ColorScaleLegendItem} from './src/app/shared/graph/graph-colors';
export * from './src/app/shared/graph/colors.utils';
export * from './src/app/shared/gesture/gesture-config';
export * from './src/app/shared/gesture/hammer.utils';
export * from './src/app/shared/validator/validators';
export * from './src/app/shared/material/latlong/latlong.utils';

// Shared test
export * from './src/app/shared/shared.testing.module';
export * from './src/app/shared/material/testing/material.testing.module';
export * from './src/app/shared/material/testing/material.testing.page';

// Core
export * from './src/app/core/core.module';

// Core model
export * from './src/app/core/services/model/account.model';
export * from './src/app/core/services/model/config.model';
export * from './src/app/core/services/model/department.model';
export * from './src/app/core/services/model/entity.model';
export * from './src/app/core/services/model/filter.model';
export * from './src/app/core/services/model/history.model';
export * from './src/app/core/services/model/model.enum';
export * from './src/app/core/services/model/peer.model';
export * from './src/app/core/services/model/person.model';
export { IReferentialRef, ReferentialRef,
  BaseReferential, Referential, ReferentialUtils,
  ReferentialAsObjectOptions,
  referentialToString, referentialsToString,
  StatusValue, DefaultStatusList,
  MINIFY_ENTITY_FOR_LOCAL_STORAGE, MINIFY_ENTITY_FOR_POD } from './src/app/core/services/model/referential.model';
export * from './src/app/core/services/model/settings.model';

// GraphQL
export * from './src/app/core/graphql/graphql.module';
export * from './src/app/core/graphql/graphql.service';

// Core pipes
export * from './src/app/core/services/pipes/account.pipes';
export * from './src/app/core/services/pipes/department-to-string.pipe';
export * from './src/app/core/services/pipes/person-to-string.pipe';
export * from './src/app/core/services/pipes/usage-mode.pipes';

// Core services
export * from './src/app/vendor';
export * from './src/app/core/services/platform.service';
export * from './src/app/core/services/network.service';
export * from './src/app/core/services/config.service';
export {CORE_CONFIG_OPTIONS} from './src/app/core/services/config/core.config';
export * from './src/app/core/services/local-settings.service';
export * from './src/app/core/services/account.service';
export * from './src/app/core/services/crypto.service';
export * from './src/app/core/services/auth-guard.service';
export * from './src/app/core/services/base58';
export * from './src/app/core/services/base-graphql-service.class';
export * from './src/app/core/services/base-entity-service.class';
export * from './src/app/core/services/storage/entities-storage.service';
export * from './src/app/core/services/storage/entity-store.class';
export * from './src/app/core/services/validator/base.validator.class';

// Core components
export * from './src/app/core/form/editor.class';
export * from './src/app/core/form/entity-editor.class';
export * from './src/app/core/form/form.class';
export * from './src/app/core/form/form.utils';
export * from './src/app/core/form/form-buttons-bar.component';
export * from './src/app/core/form/list.form';
export * from './src/app/core/form/properties.form';
export * from './src/app/core/table/table.class';
export * from './src/app/core/table/table.utils';
export * from './src/app/core/table/memory-table.class';
export * from './src/app/core/table/entities-table-datasource.class';
export * from './src/app/core/table/table-select-columns.component';
export * from './src/app/core/home/home';
export * from './src/app/core/settings/settings.page';
export * from './src/app/core/account/account';
export * from './src/app/core/register/confirm/confirm';
export * from './src/app/core/about/modal-about';
export * from './src/app/core/peer/select-peer.modal';
export * from './src/app/core/menu/menu.component';
export * from './src/app/core/menu/menu.model';
export * from './src/app/core/menu/menu.module';
export * from './src/app/core/menu/menu.service';

// Core decorator
export {EntityClass} from "./src/app/core/services/model/entity.decorators";

// Social
export * from './src/app/social/social.module';
export * from './src/app/social/services/model/user-event.model';
export * from './src/app/social/services/user-event.service';
export * from './src/app/social/list/user-events.table';

// Admin
export * from './src/app/admin/admin.module';
export {AdminRoutingModule} from './src/app/admin/admin-routing.module';
export * from './src/app/admin/services/filter/person.filter';
export * from './src/app/admin/services/validator/person.validator';
export * from './src/app/admin/services/errors';
export * from './src/app/admin/services/person.service';
export * from './src/app/admin/users/list/users';

