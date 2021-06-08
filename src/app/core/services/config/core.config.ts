// TODO: rename to CONFIG_OPTIONS_MAP
// then declare a type like this :
// > export declare type ConfigOptions = key of CONFIG_OPTIONS_MAP
import {FormFieldDefinition} from '../../../shared/form/field.model';
import {StatusIds} from '../model/model.enum';
import {UserProfileLabels} from '../model/person.model';
import {APP_LOCALES} from '../model/settings.model';
import {AuthTokenType} from '../network.service';

export const CORE_CONFIG_OPTIONS = Object.freeze({
    LOGO: <FormFieldDefinition>{
        key: 'sumaris.logo',
        label: 'CONFIGURATION.OPTIONS.LOGO',
        type: 'string'
    },
    FAVICON: <FormFieldDefinition>{
        key: 'sumaris.favicon',
        label: 'CONFIGURATION.OPTIONS.FAVICON',
        type: 'string'
    },
    DEFAULT_LOCALE: <FormFieldDefinition>{
        key: 'sumaris.defaultLocale',
        label: 'CONFIGURATION.OPTIONS.DEFAULT_LOCALE',
        type: 'enum',
        values: APP_LOCALES
    },
    DEFAULT_LAT_LONG_FORMAT: <FormFieldDefinition>{
        key: 'sumaris.defaultLatLongFormat',
        label: 'CONFIGURATION.OPTIONS.DEFAULT_LATLONG_FORMAT',
        type: 'enum',
        values: [
            {
                key: 'DDMMSS',
                value: 'COMMON.LAT_LONG.DDMMSS_PLACEHOLDER'
            },
            {
                key: 'DDMM',
                value: 'COMMON.LAT_LONG.DDMM_PLACEHOLDER'
            },
            {
                key: 'DD',
                value: 'COMMON.LAT_LONG.DD_PLACEHOLDER'
            }
        ]
    },
    AUTH_TOKEN_TYPE: <FormFieldDefinition>{
      key: 'sumaris.auth.token.type',
      label: 'CONFIGURATION.OPTIONS.AUTH_TOKEN_TYPE_PLACEHOLDER',
      type: 'enum',
      values: [
        {
          key: <AuthTokenType>'token',
          value: 'CONFIGURATION.OPTIONS.AUTH_TOKEN_TYPE.TOKEN'
        },
        {
          key: <AuthTokenType>'basic',
          value: 'CONFIGURATION.OPTIONS.AUTH_TOKEN_TYPE.BASIC'
        },
        {
          key: <AuthTokenType>'basic-and-token',
          value: 'CONFIGURATION.OPTIONS.AUTH_TOKEN_TYPE.BASIC_AND_TOKEN'
        }
      ],
      defaultValue: <AuthTokenType>'basic'
    },
    GRAVATAR_ENABLE: <FormFieldDefinition>{
      key: 'sumaris.gravatar.enable',
      label: 'CONFIGURATION.OPTIONS.ENABLE_GRAVATAR',
      type: 'boolean',
      defaultValue: false
    },
    GRAVATAR_URL: <FormFieldDefinition>{
      key: 'sumaris.gravatar.url',
      label: 'CONFIGURATION.OPTIONS.GRAVATAR_URL',
      type: 'string',
      defaultValue: 'https://www.gravatar.com/avatar/{md5}'
    },
    DATA_NOT_SELF_ACCESS_ROLE: <FormFieldDefinition>{
        key: 'sumaris.auth.notSelfDataAccess.role',
        label: 'CONFIGURATION.OPTIONS.NOT_SELF_DATA_ACCESS_MIN_ROLE',
        type: 'enum',
        values: Object.keys(UserProfileLabels).map(key => ({
            key: 'ROLE_' + key,
            value: 'USER.PROFILE_ENUM.' + key
        }))
    },
    ENTITY_TRASH: <FormFieldDefinition> {
      key: 'sumaris.persistence.trash.enable',
      label: 'CONFIGURATION.OPTIONS.ENTITY_TRASH',
      type: 'boolean',
      defaultValue: true
    },
    UPDATE_TECHNICAL_TABLES: <FormFieldDefinition> {
      key: 'sumaris.persistence.technicalTables.update',
      label: 'CONFIGURATION.OPTIONS.UPDATE_TECHNICAL_TABLES',
      type: 'boolean',
      defaultValue: false
    },
    TESTING: <FormFieldDefinition>{
        key: 'sumaris.testing.enable',
        label: 'CONFIGURATION.OPTIONS.TESTING',
        type: 'boolean'
    },
    APP_MIN_VERSION: <FormFieldDefinition>{
      key: 'sumaris.app.version.min',
      label: 'CONFIGURATION.OPTIONS.APP_MIN_VERSION',
      type: 'string'
    },
    VESSEL_DEFAULT_STATUS: <FormFieldDefinition>{
        key: 'sumaris.vessel.status.default',
        label: 'CONFIGURATION.OPTIONS.VESSEL.DEFAULT_NEW_VESSEL_STATUS',
        type: 'enum',
        values: [
            {
                key: StatusIds.ENABLE.toString(),
                value: 'REFERENTIAL.STATUS_ENUM.ENABLE'
            },
            {
                key: StatusIds.TEMPORARY.toString(),
                value: 'REFERENTIAL.STATUS_ENUM.TEMPORARY'
            }
        ]
    },
    LOGO_LARGE: <FormFieldDefinition>{
        key: 'sumaris.logo.large',
        label: 'CONFIGURATION.OPTIONS.HOME.LOGO_LARGE',
        type: 'string'
    },
    HOME_PARTNERS_DEPARTMENTS: <FormFieldDefinition>{
        key: 'sumaris.partner.departments',
        label: 'CONFIGURATION.OPTIONS.HOME.PARTNER_DEPARTMENTS',
        type: 'string'
    },
    HOME_BACKGROUND_IMAGE: <FormFieldDefinition>{
        key: 'sumaris.background.images',
        label: 'CONFIGURATION.OPTIONS.HOME.BACKGROUND_IMAGES',
        type: 'string'
    },
    COLOR_PRIMARY: <FormFieldDefinition>{
        key: 'sumaris.color.primary',
        label: 'CONFIGURATION.OPTIONS.COLORS.PRIMARY',
        type: 'color'
    },
    COLOR_SECONDARY: <FormFieldDefinition>{
        key: 'sumaris.color.secondary',
        label: 'CONFIGURATION.OPTIONS.COLORS.SECONDARY',
        type: 'color'
    },
    COLOR_TERTIARY: <FormFieldDefinition>{
        key: 'sumaris.color.tertiary',
        label: 'CONFIGURATION.OPTIONS.COLORS.TERTIARY',
        type: 'color'
    },
    COLOR_SUCCESS: <FormFieldDefinition>{
        key: 'sumaris.color.success',
        label: 'CONFIGURATION.OPTIONS.COLORS.SUCCESS',
        type: 'color'
    },
    COLOR_WARNING: <FormFieldDefinition>{
        key: 'sumaris.color.warning',
        label: 'CONFIGURATION.OPTIONS.COLORS.WARNING',
        type: 'color'
    },
    COLOR_ACCENT: <FormFieldDefinition>{
        key: 'sumaris.color.accent',
        label: 'CONFIGURATION.OPTIONS.COLORS.ACCENT',
        type: 'color'
    },
    COLOR_DANGER: <FormFieldDefinition>{
        key: 'sumaris.color.danger',
        label: 'CONFIGURATION.OPTIONS.COLORS.DANGER',
        type: 'color'
    },
    PROFILE_ADMIN_LABEL: <FormFieldDefinition>{
        key: 'sumaris.enumeration.UserProfile.ADMIN.label',
        label: 'CONFIGURATION.OPTIONS.PROFILE.ADMIN',
        type: 'string',
        defaultValue: 'ADMIN'
    },
    PROFILE_USER_LABEL: <FormFieldDefinition>{
        key: 'sumaris.enumeration.UserProfile.USER.label',
        label: 'CONFIGURATION.OPTIONS.PROFILE.USER',
        type: 'string',
        defaultValue: 'USER'
    },
    PROFILE_SUPERVISOR_LABEL: <FormFieldDefinition>{
        key: 'sumaris.enumeration.UserProfile.SUPERVISOR.label',
        label: 'CONFIGURATION.OPTIONS.PROFILE.SUPERVISOR',
        type: 'string',
        defaultValue: 'SUPERVISOR'
    },
    PROFILE_GUEST_LABEL: <FormFieldDefinition>{
        key: 'sumaris.enumeration.UserProfile.GUEST.label',
        label: 'CONFIGURATION.OPTIONS.PROFILE.GUEST',
        type: 'string',
        defaultValue: 'GUEST'
    },
    ANDROID_INSTALL_URL: <FormFieldDefinition>{
        key: 'sumaris.android.install.url',
        label: 'CONFIGURATION.OPTIONS.ANDROID_INSTALL_URL',
        type: 'string'
    }
});

export const CORE_LOCAL_SETTINGS_OPTIONS = Object.freeze({});
