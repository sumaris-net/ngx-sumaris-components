import {gql} from '@apollo/client/core';

export const SocialFragments = {
  userEvent: gql`fragment UserEventFragment on UserEventVO {
    id
    issuer
    updateDate
    creationDate
    eventType
    recipient
    content
    hash
    signature
    readSignature
    __typename
  }`,
  lightUserEvent: gql`fragment LightUserEventFragment on UserEventVO {
    id
    issuer
    recipient
    updateDate
    creationDate
    eventType
    readSignature
    __typename
  }`
};
