import {TypePolicies} from "@apollo/client/core";
import {FormFieldDefinition} from "../../../shared/form/field.model";

export const EXTRACTION_GRAPHQL_TYPE_POLICIES = <TypePolicies>{
  'ExtractionTypeVO': {
    keyFields: ['category', 'label']
  }
};

/**
 * Define configuration options
 */
export const EXTRACTION_CONFIG_OPTIONS = Object.freeze({
  EXTRACTION_ENABLE: <FormFieldDefinition>{
    key: 'sumaris.extraction.enable',
    label: 'EXTRACTION.OPTIONS.ENABLE',
    type: 'boolean',
    defaultValue: 'false'
  },
  EXTRACTION_MAP_ENABLE: <FormFieldDefinition>{
    key: 'sumaris.extraction.map.enable',
    label: 'EXTRACTION.OPTIONS.MAP_ENABLE',
    type: 'boolean',
    defaultValue: 'false'
  }
});
