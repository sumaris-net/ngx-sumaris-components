import {Inject, Injectable} from '@angular/core';
import {BaseGraphqlService} from './base-graphql-service.class';
import {GraphqlService} from '../graphql/graphql.service';
import {ErrorCodes} from './errors';
import {gql} from '@apollo/client/core';
import {chainPromises} from '../../shared/observables';
import {ENVIRONMENT} from '../../../environments/environment.class';

// Load a trash file
const LoadQuery: any = gql`
  query TrashEntity($entityName:String, $id: String){
    trashEntity(entityName: $entityName, id: $id)
  }
`;
// Delete a trash file
const DeleteMutation: any = gql`
  mutation DeleteTrashEntity($entityName:String, $id: String){
    deleteTrashEntity(entityName: $entityName, id: $id)
  }
`;

@Injectable({providedIn: 'root'})
export class TrashRemoteService extends BaseGraphqlService<string, any> {


  constructor(
    protected graphql: GraphqlService,
    @Inject(ENVIRONMENT) protected environment
  ) {
    super(graphql, environment);

    if (this._debug) console.debug('[trash-service] Creating service');
  }

  async load(entityName: string, id: number): Promise<any> {
    if (this._debug) console.debug(`[trash-service] Load ${entityName}#${id} from the remote trash...`);

    // Execute mutation
    const res = await this.graphql.query<{trashEntity: string}>({
      query: LoadQuery,
      variables: {
        entityName,
        id
      },
      error: {
        code: ErrorCodes.LOAD_TRASH_ENTITY_ERROR,
        message: 'ERROR.LOAD_TRASH_ENTITY_ERROR'
      }
    });

    return res && res.trashEntity && JSON.parse(res.trashEntity);
  }

  async delete(entityName: string, id: number) {
    if (this._debug) console.debug(`[trash-service] Deleting ${entityName}#${id} from the remote trash...`);

    // Execute mutation
    await this.graphql.mutate<any>({
      mutation: DeleteMutation,
      variables: {
        entityName,
        id
      },
      error: {
        code: ErrorCodes.DELETE_TRASH_ENTITY_ERROR,
        message: 'ERROR.DELETE_TRASH_ENTITY_ERROR'
      }
    });
  }

  async deleteAll(entityName: string, ids: number[]) {
    // Delete one by one
    return chainPromises((ids || [])
      .map(id => (() => this.delete(entityName, id))));
  }
}
