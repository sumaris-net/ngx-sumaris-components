import {Inject, Injectable} from '@angular/core';
import {CryptoService, KeyPair} from './crypto.service';
import {Department} from './model/department.model';
import {Account} from './model/account.model';
import {Person, PersonUtils, UserProfileLabel, UserProfileLabels} from './model/person.model';
import {UsageMode, UserSettings} from './model/settings.model';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {FetchPolicy, gql} from '@apollo/client/core';
import {Storage} from '@ionic/storage';

import {sleep} from '../../shared/functions';
import {BaseGraphqlService} from './base-graphql-service.class';
import {ErrorCodes, ServerErrorCodes} from './errors';
import {GraphqlService} from '../graphql/graphql.service';
import {LocalSettingsService} from './local-settings.service';
import {FormFieldDefinition} from '../../shared/form/field.model';
import {AuthTokenType, NetworkService} from './network.service';
import {FileService} from '../../shared/file/file.service';
import {Referential, ReferentialUtils} from './model/referential.model';
import {StatusIds} from './model/model.enum';
import {Base58} from './base58';
import {ENVIRONMENT} from '../../../environments/environment.class';
import {toDateISOString} from '../../shared/dates';


export declare interface AccountHolder {
  loaded: boolean;
  keypair: KeyPair;
  authToken: string;
  authBasic?: string;
  pubkey: string;
  account: Account;
  person: Person;
  department: Department;
  // TODO : use this ?
  mainProfile: String;
}
export interface AuthData {
  username: string;
  password: string;
  offline?: boolean;
}
export interface RegisterData extends AuthData {
  account: Account;
}

const TOKEN_STORAGE_KEY = 'token';
const PUBKEY_STORAGE_KEY = 'pubkey';
const SECKEY_STORAGE_KEY = 'seckey';
const ACCOUNT_STORAGE_KEY = 'account';

const DEFAULT_AVATAR_IMAGE = 'assets/img/person.png';

/* ------------------------------------
 * GraphQL queries
 * ------------------------------------*/
const Fragments = {
  account: gql`
    fragment AccountFragment on AccountVO {
      id
      firstName
      lastName
      email
      pubkey
      avatar
      statusId
      updateDate
      creationDate
      profiles
      settings {
        id
        locale
        latLongFormat
        content
        nonce
        updateDate
        __typename
      }
      department {
        id
        label
        name
        __typename
      }
      __typename
    }
  `
};

// Load account query
const LoadQuery: any = gql`
  query Account {
    account {
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Check email query
const IsEmailExistsQuery: any = gql`
  query IsEmailExists($email: String, $hash: String){
    isEmailExists(email: $email, hash: $hash)
  }
`;
export declare interface IsEmailExistsVariables {
  email: string;
  hash: string;
}

// Save (create or update) account mutation
const SaveMutation: any = gql`
  mutation SaveAccount($account:AccountVOInput){
    saveAccount(account: $account){
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Create account mutation
const CreateMutation: any = gql`
  mutation CreateAccount($account:AccountVOInput){
    createAccount(account: $account){
      ...AccountFragment
    }
  }
  ${Fragments.account}
`;

// Sent confirmation email
const SendConfirmEmailMutation: any = gql`
  mutation sendAccountConfirmationEmail($email:String, $locale:String){
    sendAccountConfirmationEmail(email: $email, locale: $locale)
  }
`;

// Confirm account email
const ConfirmEmailMutation: any = gql`
  mutation confirmAccountEmail($email:String, $code:String){
    confirmAccountEmail(email: $email, code: $code)
  }
`;

// Authentication  query
const AuthQuery: any = gql`
  query Auth($token: String){
    authenticate(token: $token)
  }
`;

// New auth challenge query
const AuthChallengeQuery: any = gql`
  query AuthChallenge{
    authChallenge{
      challenge
      pubkey
      signature
    }
  }
`;

const UpdateSubscription: any = gql`
  subscription updateAccount($interval: Int){
    updateAccount(interval: $interval) {
      id
      updateDate
    }
  }
`;

@Injectable({providedIn: 'root'})
export class AccountService extends BaseGraphqlService {

  private data: AccountHolder = {
    loaded: false,
    keypair: null,
    authToken: null,
    authBasic: null,
    pubkey: null,
    mainProfile: null,
    account: null,
    person: null,
    department: null
  };

  private _startPromise: Promise<any>;
  private _started = false;
  private _$additionalFields = new BehaviorSubject<FormFieldDefinition[]>([]);
  private _tokenType: AuthTokenType = 'token';

  onLogin = new Subject<Account>();
  onLogout = new Subject<any>();
  onAuthTokenChange = new Subject<string | undefined>();
  onAuthBasicChange = new Subject<string | undefined>();

  get account(): Account {
    return this.data.loaded ? this.data.account : undefined;
  }

  get person(): Person {
    if (this.data.loaded && !this.data.person) {
      this.data.person = this.data.loaded ? this.data.account.asPerson() : undefined;
    }
    return this.data.person;
  }

  get department(): Department {
    if (this.data.loaded && !this.data.department) {
      this.data.department = this.data.loaded ? this.data.account.asPerson().department : undefined;
    }
    return this.data.department;
  }

  get tokenType(): AuthTokenType {
    return this._tokenType;
  }

  set tokenType(value: AuthTokenType) {
    if (this._tokenType !== value) {
      console.info('[account] Using authentication token type: ' + value);
      this._tokenType = value;
      // Reset values
      this.data.authToken = undefined;
      this.onAuthTokenChange.next(undefined);
      this.data.authBasic = undefined;
      this.onAuthBasicChange.next(undefined);
    }
  }

  constructor(
    private cryptoService: CryptoService,
    protected network: NetworkService,
    protected graphql: GraphqlService,
    protected settings: LocalSettingsService,
    protected storage: Storage,
    protected file: FileService,
    @Inject(ENVIRONMENT) protected environment
  ) {
    super(graphql, environment);
    this._debug = !environment.production;
    if (this._debug) console.debug('[account-service] Creating service');

    this.resetData();

    // Send auth token to the graphql layer, when changed
    this.onAuthTokenChange.subscribe((token) => this.graphql.setAuthToken(token));
    this.onAuthBasicChange.subscribe((basic) => this.graphql.setAuthBasic(basic));

    // Listen network restart
    this.graphql.onStart.subscribe(async () => {
      if (!this._started) {
        this.ready();
      }
      if (this._started && this.isLogin()) {
        console.debug('[account] Restarting, to retry to authenticate...');
        this.restart();
      }
    });

    // Force network to wait account service, after getting connection to the peer
    this.network.on('beforeTryOnlineFinish', async (online) => {
      // If online, wait a full restart, because it can force offline mode
      if (online && (!this._started || this.isLogin())) {
        console.debug('[account] Force networkService.tryOnline() to wait, that account service is restarted...');
        //await this.stop();
        await sleep(500);
        return this.ready();
      }
    });


  }

  private resetData() {
    this.data.loaded = false;
    this.data.keypair = null;
    this.data.authToken = null;
    this.data.authBasic = null;
    this.data.pubkey = null;
    this.data.mainProfile = null;
    this.data.account = new Account();
    this.data.person = null;
    this.data.department = null;
  }

  start(): Promise<void> {
    if (this._startPromise) return this._startPromise;
    if (this._started) return Promise.resolve();

    // Restoring local settings
    this._startPromise = this.settings.ready()
      .then(() => this.restoreLocally())
      .then(() => {
        this._started = true;
        this._startPromise = undefined;
      });
    return this._startPromise;
  }

  public get started(): boolean {
    return this._started;
  }

  async stop() {
    if (this._started || this._startPromise) {
      this._started = false;
      this._startPromise = undefined;

      const hadAuth = (this.data.authToken || this.data.authBasic) && true;
      this.resetData();
      if (hadAuth) {
        this.onAuthTokenChange.next(undefined);
        this.onAuthBasicChange.next(undefined);
      }
    }
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  ready(): Promise<void> {
    if (this._started) return Promise.resolve();
    return this.start();
  }

  isLogin(): boolean {
    return !!(this.data.pubkey && this.data.loaded);
  }

  isAuth(): boolean {
    return !!(this.data.pubkey && this.data.keypair && this.data.keypair.secretKey);
  }

  hasMinProfile(userProfile: UserProfileLabel): boolean {
    // should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId !== StatusIds.ENABLE && this.data.account.statusId !== StatusIds.TEMPORARY)) {
      return false;
    }
    return PersonUtils.hasUpperOrEqualsProfile(this.data.account.profiles, userProfile);
  }

  hasExactProfile(userProfile: UserProfileLabel): boolean {
    // should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId !== StatusIds.ENABLE && this.data.account.statusId !== StatusIds.TEMPORARY))
      return false;
    const label = UserProfileLabels[userProfile];
    return !!this.data.account.profiles.find(profile => profile === label);
  }

  hasProfileAndIsEnable(userProfile: UserProfileLabel): boolean {
    // should be login, and status ENABLE
    if (!this.data.account || !this.data.account.pubkey || this.data.account.statusId !== StatusIds.ENABLE) return false;
    return PersonUtils.hasUpperOrEqualsProfile(this.data.account.profiles, userProfile);
  }

  isAdmin(): boolean {
    return this.hasProfileAndIsEnable('ADMIN');
  }

  isSupervisor(): boolean {
    return this.hasProfileAndIsEnable('SUPERVISOR');
  }

  isUser(): boolean {
    return this.hasProfileAndIsEnable('USER');
  }

  /**
   * @deprecated
   * @param mode
   */
  isUsageMode(mode: UsageMode): boolean {
    return this.settings.isUsageMode(mode);
  }

  isOnlyGuest(): boolean {
    // Should be login, and status ENABLE or TEMPORARY
    if (!this.data.account || !this.data.account.pubkey ||
      (this.data.account.statusId !== StatusIds.ENABLE && this.data.account.statusId !== StatusIds.TEMPORARY))
      return false;
    // Profile less then user
    return !PersonUtils.hasUpperOrEqualsProfile(this.data.account.profiles, 'USER');
  }

  canUserWriteDataForDepartment(recorderDepartment: Referential | any): boolean {
    if (ReferentialUtils.isEmpty(recorderDepartment)) {
      if (!this.isAdmin())
        console.warn('Unable to check if user has right: invalid recorderDepartment', recorderDepartment);
      return this.isAdmin();
    }

    // Should be login, and status ENABLE
    if (!this.data.account || !this.data.account.pubkey || this.data.account.statusId !== StatusIds.ENABLE) return false;

    if (!this.data.account.department || !this.data.account.department.id) {
      console.warn('User account has no department ! Unable to check write right against recorderDepartment');
      return false;
    }

    // Same recorder department: OK, user can write
    if (this.data.account.department.id === recorderDepartment.id) return true;

    // Else, check if supervisor (or more)
    return PersonUtils.hasUpperOrEqualsProfile(this.data.account.profiles, 'SUPERVISOR');
  }

  async register(data: RegisterData): Promise<Account> {
    if (this.isLogin()) {
      throw new Error('User already login. Please logout before register.');
    }
    if (!data.username || !data.username) throw new Error('Missing required username por password');

    if (this._debug) console.debug('[account] Register new user account...', data.account);
    this.data.loaded = false;
    const now = Date.now();

    try {
      const keypair = await this.cryptoService.scryptKeypair(data.username, data.password);
      data.account.pubkey = Base58.encode(keypair.publicKey);

      // Default values
      data.account.settings.locale = this.settings.locale;
      data.account.settings.latLongFormat = this.settings.latLongFormat;
      data.account.department.id = data.account.department.id || this.environment.defaultDepartmentId;

      this.data.keypair = keypair;
      const account = await this.saveAccount(data.account, keypair);

      // Default values
      account.avatar = account.avatar || (this.environment.baseUrl + DEFAULT_AVATAR_IMAGE);
      this.data.mainProfile = PersonUtils.getMainProfile(account.profiles);

      this.data.account = account;
      this.data.pubkey = account.pubkey;

      // Try to auth on pod
      await this.authenticate(data);

      this.data.loaded = true;

      await this.saveLocally();

      console.debug('[account] Account successfully registered in ' + (Date.now() - now) + 'ms');
      this.onLogin.next(this.data.account);
      return this.data.account;
    }
    catch (error) {
      console.error(error && error.message || error);
      this.resetData();
      throw error;
    }
  }

  async authenticate(data?: AuthData) {
    // Basic auth
    if (this._tokenType === 'basic' || this._tokenType === 'basic-and-token') {

      // Generate the authBasic, if used
      if (!this.data.authBasic) {
        // Skip if token already provided
        if (!(this.data.authToken && this._tokenType === 'basic-and-token')) {
          if (!data || !data.username || !data.password) throw new Error('Missing username and password');
          this.data.authBasic = this.cryptoService.encodeBase64(`${data.username}:${data.password}`);
        }
      }
      this.onAuthBasicChange.next(this.data.authBasic);
    }

    // Generate the authToken, if used
    if (this._tokenType === 'token' || this._tokenType === 'basic-and-token') {
      try {
        this.data.authToken = await this.authenticateAndGetToken(this.data.authToken);
      } catch (error) {
        // Never authenticate, or not ready for offline mode => exit
        console.error(error);
        this.resetData();
        throw error;
      }
    }

    // Forget authBasic, to switch to authToken
    if (this._tokenType === 'basic-and-token') {
      this.data.authBasic = undefined; // TODO: store it ?
      this.onAuthBasicChange.next(undefined);
    }
  }

  async login(data: AuthData): Promise<Account> {
    if (!data || !data.username || !data.password) throw new Error('Missing required username or password');

    console.debug('[account] Login...');

    let keypair;
    try {
      keypair = await this.cryptoService.scryptKeypair(data.username, data.password);
    } catch (error) {
      console.error(error);
      this.resetData();
      throw { code: ErrorCodes.UNKNOWN_ERROR, message: 'ERROR.SCRYPT_ERROR' };
    }

    // Store pubkey+keypair
    this.data.pubkey = Base58.encode(keypair.publicKey);
    this.data.keypair = keypair;

    // Try to load previous token
    let previousToken: string = await this.storage.get(TOKEN_STORAGE_KEY);
    previousToken = previousToken && previousToken.startsWith(this.data.pubkey) && previousToken || null;

    // Offline mode
    const offline = this.settings.hasOfflineFeature() && (this.network.offline || data.offline === true);
    if (offline)  {
      this.data.authToken = previousToken;

      // Make sure network if set as offline
      this.network.setForceOffline(true, {showToast: false});
      console.info(`[account] Login [OK] {pubkey: ${this.data.pubkey.substr(0, 8)}}, {offline: true}`);
    }

    // Online mode: try to auth on pod
    else {

      try {
        await this.authenticate(data);
      } catch (error) {
        // Never authenticate, or not ready for offline mode => exit
        console.error(error);
        this.resetData();
        throw error;
      }
    }

    // Load account data
    try {
      await this.loadData({offline, fetchPolicy: 'network-only'});
    }
    catch (err) {
      // If account not found, check if email is valid
      if (err && +(err.code) === ErrorCodes.LOAD_ACCOUNT_ERROR) {

        // Check email exists
        if (data.username.indexOf('@') !== -1) {
          let isEmailExists;
          try {
            isEmailExists = await this.isEmailExists(data.username);
          } catch (otherError) {
            throw err; // resend the first error
          }

          // Email not exists (no account)
          if (!isEmailExists) {
            throw { code: ErrorCodes.UNKNOWN_ACCOUNT_EMAIL, message: 'ERROR.UNKNOWN_ACCOUNT_EMAIL' };
          }
        }

        // Email exists, so error = 'bad password'
        throw { code: ErrorCodes.BAD_PASSWORD, message: 'ERROR.BAD_PASSWORD' };
      }

      throw err; // resend the first error
    }

    try {
      // Store to local storage
      await this.saveLocally();
    }
    catch (error) {
      console.error(error);
      this.resetData();
      throw error;
    }

    // Emit event to observers
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  async refresh(): Promise<Account> {
    if (!this.data.pubkey) throw new Error('User not logged');
    if (this.network.offline) throw new Error('Cannot check account in offline mode');

    await this.loadData();
    await this.saveLocally();

    console.debug('[account] Successfully reload account');

    // Emit login event to subscribers
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  async loadData(opts?: {
    offline?: boolean;
    fetchPolicy?: FetchPolicy;
  }): Promise<Account> {
    if (!this.data.pubkey) throw new Error('User not logged');

    this.data.loaded = false;

    try {
      const account = (await this.loadAccount(opts)) || new Account();

      // Set defaults
      account.avatar = account.avatar || (this.environment.baseUrl + DEFAULT_AVATAR_IMAGE);
      account.settings = account.settings || new UserSettings();
      account.settings.locale = account.settings.locale || this.settings.locale;
      account.settings.latLongFormat = account.settings.latLongFormat || this.settings.latLongFormat || 'DDMM';

      // Read main profile
      this.data.mainProfile = PersonUtils.getMainProfile(account.profiles);

      if (this.data.account) {
        this.data.account.fromObject(account);
      }
      else {
        this.data.account = account;
      }
      this.data.loaded = true;
      return this.data.account;
    }
    catch (error) {
      this.resetData();
      if (error.code && error.message) throw error;

      console.error(error);
      throw {
        code: ErrorCodes.LOAD_ACCOUNT_ERROR,
        message: 'ERROR.LOAD_ACCOUNT_ERROR'
      };
    }
  }

  public async restoreLocally(): Promise<Account | undefined> {

    // Restore from storage
    const values = await Promise.all([
      this.storage.get(PUBKEY_STORAGE_KEY),
      this.storage.get(TOKEN_STORAGE_KEY),
      this.storage.get(SECKEY_STORAGE_KEY)
    ]);
    const pubkey = values[0];
    const token = values[1];
    const seckey = values[2];

    // Quit if no pubkey (not logged)
    if (!pubkey) return;

    // Quit if could not auth on pod
    const canRemoteAuth = token || seckey || false;
    if (!canRemoteAuth) return;

    if (this._debug) console.debug(`[account] Account restoration...`);

    this.data.authToken = token;
    this.data.pubkey = pubkey;
    this.data.keypair = seckey && {
      publicKey: Base58.decode(pubkey),
      secretKey: Base58.decode(seckey)
    } || null;

    // Online mode: try to connect to pod
    if (this.network.online) {
      try {
        await this.authenticate();
        if (!this.data.authToken && !this.data.authBasic) throw new Error('Authentication failed');
      }
      catch (error) {
        // Offline feature are enable: continue in offline mode
        if (this.settings.hasOfflineFeature()) {
          console.warn('[account] Unable to authenticate on pod: forcing offline mode');
          this.network.setForceOffline(true, {showToast: false});
          // Continue
        }
        // No offline features enable (=offline mode not allowed)
        else {
          console.error(error);
          this.logout();
          return;
        }

      }
    }

    // Get the account, from pubkey
    let jsonAccount = await this.storage.get(`${ACCOUNT_STORAGE_KEY}#${pubkey}`);
    if (!jsonAccount) {
      // Try using the old storage key
      const accountStr = await this.storage.get(ACCOUNT_STORAGE_KEY);
      jsonAccount = accountStr && ((typeof accountStr === 'string') && JSON.parse(jsonAccount) || accountStr);
    }

    // Invalid account: do not use it
    if (!jsonAccount || jsonAccount.pubkey !== pubkey) return;

    // Transform to entity
    const account = Account.fromObject(jsonAccount);

    // Update data
    this.data.account = account;
    this.data.mainProfile = PersonUtils.getMainProfile(account.profiles);
    this.data.loaded = true;

    // Emit event
    this.onLogin.next(this.data.account);

    if (this._debug) console.debug(`[account] Account restoration [OK] {pubkey: ${pubkey.substr(0, 8)}}, {profile: ${this.data.mainProfile}}`);

    return account;
  }

  /**
   * Save account into the local storage
   */
  async saveLocally(): Promise<void> {
    if (!this.data.pubkey) throw new Error('User not logged');

    if (this._debug) console.debug(`[account] Saving account {${this.data.pubkey.substring(0, 6)}} in local storage...`);

    // Convert account to json
    const jsonAccount = this.data.account.asObject({keepTypename: true});
    const seckey = this.data.keypair && this.data.keypair.secretKey && Base58.encode(this.data.keypair.secretKey) || null;

    // Convert avatar URL to dataUrl (e.g. 'data:image/png:<base64 content>')
    const hasAvatarUrl = jsonAccount.avatar && !jsonAccount.avatar.endsWith(DEFAULT_AVATAR_IMAGE) &&
      (jsonAccount.avatar.startsWith('http://') || (jsonAccount.avatar.startsWith('https://')));
    if (hasAvatarUrl && this.network.online) {
      this.file.getImage(jsonAccount.avatar, {
        thumbnail: true,
        responseType: 'dataUrl'
      })
        .then(dataUrl => {
          if (dataUrl && this._debug) console.debug('[account] Image fetched: ', dataUrl.substring(0, 50));

          // TODO: make sure to display Base64 image in the menu top header
          //jsonAccount.avatar = dataUrl;
        })
        .catch(err => {
          console.error(`[account] Error while fetching image: ${jsonAccount.avatar}: ${err}`);
        });
    }

    await Promise.all([
      this.storage.set(PUBKEY_STORAGE_KEY, this.data.pubkey),
      this.storage.set(TOKEN_STORAGE_KEY, this.data.authToken),
      this.storage.set(`${ACCOUNT_STORAGE_KEY}#${this.data.pubkey}`, jsonAccount),
      // Secret key (optional)
      seckey && this.storage.set(SECKEY_STORAGE_KEY, seckey) || this.storage.remove(SECKEY_STORAGE_KEY),
      // Remove old storage key
      this.storage.remove(ACCOUNT_STORAGE_KEY)
    ]);

    if (this._debug) console.debug('[account] Account saved in local storage');
  }

  /**
   * Create or update an user account, to the remote storage
   *
   * @param account
   */
  public async saveRemotely(account: Account): Promise<Account> {
    if (!this.data.pubkey) return Promise.reject('User not logged');
    if (this.data.pubkey !== account.pubkey) return Promise.reject('Not user account');

    account = await this.saveAccount(account, this.data.keypair);

    // Set defaults
    account.avatar = account.avatar || (this.environment.baseUrl + DEFAULT_AVATAR_IMAGE);
    this.data.mainProfile = PersonUtils.getMainProfile(account.profiles);

    this.data.account = account;
    this.data.loaded = true;

    // Save locally (in storage)
    await this.saveLocally();

    // Send event
    this.onLogin.next(this.data.account);

    return this.data.account;
  }

  public async logout(): Promise<void> {

    const hadAuthToken = this.data.authToken && true;
    const pubkey = this.data && this.data.pubkey;

    this.resetData();

    if (!this.settings.hasOfflineFeature()) {

      // Remove all data from the local storage
      await Promise.all([
        this.storage.remove(PUBKEY_STORAGE_KEY),
        this.storage.remove(TOKEN_STORAGE_KEY),
        this.storage.remove(ACCOUNT_STORAGE_KEY),
        pubkey && this.storage.remove(ACCOUNT_STORAGE_KEY + '#' + pubkey) || Promise.resolve(),
        this.storage.remove(SECKEY_STORAGE_KEY)
      ]);
    }

    // Offline features enable: need to keep some data
    else {
      // Always remove only secret key
      // But keep:
      // - account by pubkey
      // - auth token
      await Promise.all([
        this.storage.remove(PUBKEY_STORAGE_KEY),
        this.storage.remove(ACCOUNT_STORAGE_KEY),
        this.storage.remove(SECKEY_STORAGE_KEY)
      ]);
    }

    // Clean page history, in local settings
    await this.settings.clearPageHistory();

    // Notify observers
    this.onLogout.next();
    if (hadAuthToken) this.onAuthTokenChange.next(undefined);
  }

  /**
   * Load a account by pubkey
   *
   * @param pubkey
   */
  public async loadAccount(opts?: {
    offline?: boolean;
    fetchPolicy?: FetchPolicy;
  }): Promise<Account | undefined> {

    const now = this._debug && Date.now();
    if (this._debug) console.debug(`[account] Loading account...`);
    let accountJson: any;

    const offline = this.network.offline
      && (!opts || (opts.fetchPolicy !== 'network-only' && opts.fetchPolicy !== 'no-cache'))
      || (opts && opts.offline === true);
    if (offline) {
      accountJson = await this.storage.get(ACCOUNT_STORAGE_KEY);
      accountJson = accountJson && (typeof accountJson === 'string') && JSON.parse(accountJson) || accountJson;
      accountJson = accountJson && this.data.pubkey && (accountJson.pubkey === this.data.pubkey) && accountJson || null;
      if (!accountJson && this.data.pubkey) {
        accountJson = await this.storage.get(ACCOUNT_STORAGE_KEY + '#' + this.data.pubkey);
        accountJson = accountJson && (typeof accountJson === 'string') && JSON.parse(accountJson) || accountJson;
      }
    }
    else {
      const res = await this.graphql.query<{ account: any }>({
        query: LoadQuery,
        error: { code: ErrorCodes.LOAD_ACCOUNT_ERROR, message: 'ERROR.LOAD_ACCOUNT_ERROR' },
        fetchPolicy: opts && opts.fetchPolicy || 'no-cache' || undefined
      });
      accountJson = res && res.account;
    }

    if (accountJson) {
      const account = Account.fromObject(accountJson);
      if (this._debug) console.debug(`[account] Account loaded in ${Date.now() - now}ms`, account);
      return account;
    }
    else {
      console.warn(`[account] Account not found !`);
      return undefined;
    }
  }

  /**
   * Create or update an user account
   *
   * @param account
   * @param keyPair
   */
  public async saveAccount(account: Account, keyPair: KeyPair): Promise<Account> {
    account.pubkey = account.pubkey || Base58.encode(keyPair.publicKey);

    const now = this._debug && Date.now();
    if (this._debug) console.debug(`[account] Saving account remotely...`);


    const isNew = !account.id && account.id !== 0;

    // If this is an update: get existing account's updateDate, to avoid 'version error' when saving
    if (!isNew) {
      const existingAccount = await this.loadAccount({ fetchPolicy: 'network-only' });
      if (!existingAccount || !existingAccount.updateDate) {
        throw { code: ErrorCodes.ACCOUNT_NOT_EXISTS, message: 'ERROR.ACCOUNT_NOT_EXISTS' };
      }
      account.updateDate = existingAccount.updateDate || account.updateDate;
      if (account.settings && existingAccount.settings) {
        account.settings.updateDate = existingAccount.settings.updateDate || account.settings.updateDate;
      }
    }

    const json = account.asObject();

    // User not allow to change his profiles
    delete json.profiles;
    delete json.mainProfile; // Not known on server

    // Execute mutation
    const res = await this.graphql.mutate<{ saveAccount: any }>({
      mutation: isNew ? CreateMutation : SaveMutation,
      variables: {
        account: json
      },
      error: {
        code: ErrorCodes.SAVE_ACCOUNT_ERROR,
        message: 'ERROR.SAVE_ACCOUNT_ERROR'
      }
    });

    const savedAccount = res && res.saveAccount;

    // Copy update properties
    account.id = savedAccount && savedAccount.id || account.id;
    account.updateDate = savedAccount && savedAccount.updateDate || account.updateDate;
    account.settings.id = savedAccount && savedAccount.settings && savedAccount.settings.id || account.settings.id;
    account.settings.updateDate = savedAccount && savedAccount.settings && savedAccount.settings.updateDate || account.settings.updateDate;

    if (this._debug) console.debug(`[account] Account remotely saved in ${Date.now() - now}ms`);

    return account;
  }

  /**
   * Check if email is available for new account registration.
   * Throw an error if not available
   *
   * @param email
   */
  public async checkEmailAvailable(email: string): Promise<void> {
    const isEmailExists = await this.isEmailExists(email);
    if (isEmailExists) {
      throw { code: ErrorCodes.EMAIL_ALREADY_REGISTERED, message: 'ERROR.EMAIL_ALREADY_REGISTERED' };
    }
  }

  /**
   * Check if email is exists in server.
   *
   * @param email
   */
  async isEmailExists(email: string): Promise<boolean> {

    if (this._debug) console.debug('[account] Checking if {' + email + '} exists...');

    const data = await this.graphql.query<{ isEmailExists: boolean }, IsEmailExistsVariables>({
      query: IsEmailExistsQuery,
      variables: {
        email,
        hash: undefined
      }
    });

    if (this._debug) console.debug('[account] Email exist: ' + (data && data.isEmailExists));

    return data && data.isEmailExists;
  }

  async sendConfirmationEmail(email: String, locale?: string): Promise<boolean> {

    locale = locale || this.settings.locale;
    console.debug('[account] Sending confirmation email to {' + email + '} with locale {' + locale + '}...');

    return await this.graphql.mutate<boolean>({
      mutation: SendConfirmEmailMutation,
      variables: {
        email,
        locale
      },
      error: {
        code: ErrorCodes.SENT_CONFIRMATION_EMAIL_FAILED,
        message: 'ERROR.SENT_ACCOUNT_CONFIRMATION_EMAIL_FAILED'
      }
    });
  }

  async confirmEmail(email: String, code: String): Promise<boolean> {

    console.debug('[account] Sendng confirm request for email {' + email + '} with code {' + code + '}...');

    const res = await this.graphql.mutate<{ confirmAccountEmail: boolean }>({
      mutation: ConfirmEmailMutation,
      variables: {
        email,
        code
      },
      error: {
        code: ErrorCodes.CONFIRM_EMAIL_FAILED,
        message: 'ERROR.CONFIRM_ACCOUNT_EMAIL_FAILED'
      }
    });
    return res && res.confirmAccountEmail;
  }

  public listenChanges(): Subscription {
    if (!this.data.pubkey) return Subscription.EMPTY;

    const self = this;

    console.debug('[account] [WS] Listening account changes');

    const subscription = this.graphql.subscribe<{updateAccount: any}>({
      query: UpdateSubscription,
      variables: {
        interval: 10
      },
      error: {
        code: ErrorCodes.SUBSCRIBE_ACCOUNT_ERROR,
        message: 'ERROR.ACCOUNT.SUBSCRIBE_ACCOUNT_ERROR'
      }
    }).subscribe({
      async next({updateAccount}) {
        if (!updateAccount) return;
        const existingUpdateDate = self.data.account && toDateISOString(self.data.account.updateDate);
        if (existingUpdateDate !== updateAccount.updateDate) {
          console.debug('[account] [WS] Detected update on {' + updateAccount.updateDate + '}');
          await self.refresh();
        }
      },
      async error(err) {
        if (err && +err.code === ServerErrorCodes.NOT_FOUND) {
          console.info('[account] Account not exists anymore: force user to logout...', err);
          await self.logout();
        }
        else if (err && +err.code === ServerErrorCodes.UNAUTHORIZED) {
          console.info('[account] Account not authorized: force user to logout...', err);
          await self.logout();
        }
        else {
          console.warn('[account] [WS] Received error:', err);
        }
      },
      complete() {
        console.debug('[account] [WS] Completed');
      }
    });

    // Add log when closing WS
    subscription.add(() => console.debug('[account] [WS] Stop listening account changes'));

    return subscription;
  }

  /**
   * @deprecated
   */
  public getPageSettings(pageId: string, propertyName?: string): string[] {
    return this.settings.getPageSettings(pageId, propertyName);
  }

  /**
   * @deprecated
   */
  public async savePageSetting(pageId: string, value: any, propertyName?: string) {
    await this.settings.savePageSetting(pageId, value, propertyName);
  }

  get additionalFields(): FormFieldDefinition[] {
    return this._$additionalFields.getValue();
  }

  get $additionalFields(): Observable<FormFieldDefinition[]> {
    return this._$additionalFields;
  }

  getAdditionalField(key: string): FormFieldDefinition | undefined {
    return this._$additionalFields.getValue().find(f => f.key === key);
  }

  registerAdditionalField(field: FormFieldDefinition) {
    const values = this._$additionalFields.getValue();
    if (!!values.find(f => f.key === field.key)) {
      throw new Error(`Additional account field {key: ${field.key}} already define.`);
    }
    if (this._debug) console.debug(`[account] Found additional account's field {key: ${field.key}}`);
    this._$additionalFields.next(values.concat(field));
  }

  async authenticateAndGetToken(token?: string, counter?: number): Promise<string> {
    if (!this.data.pubkey) throw new Error('User not logged');

    if (!counter) console.info('[account] Authentication on pod...');

    if (counter > 4) {
      if (this._debug) console.debug(`[account] Failed to authentication on pod (after ${counter} attempts)`);
      throw { code: ErrorCodes.AUTH_SERVER_ERROR, message: 'ERROR.AUTH_SERVER_ERROR' };
    }

    // Check if valid
    if (token) {
      const data = await this.graphql.query<{ authenticate: boolean }, { token: string }>({
        query: AuthQuery,
        variables: {
          token
        },
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'ERROR.UNAUTHORIZED'
        },
        fetchPolicy: 'no-cache'
      });

      // Token is accepted by the server
      if (data && data.authenticate) {
        // Store the token
        this.onAuthTokenChange.next(token);

        console.info(`[account] Authentication on pod [OK] {pubkey: '${this.data.pubkey.substr(0, 8)}'}`);
        return token; // return the token
      }

      // Continue (will retry with another challenge)
    }

    // Generate a new token
    const challengeError = {
      code: ErrorCodes.AUTH_CHALLENGE_ERROR,
      message: 'ERROR.AUTH_CHALLENGE_ERROR'
    };
    const data = await this.graphql.query<{
      authChallenge: {
        pubkey: string;
        challenge: string;
        signature: string;
      };
    }>({
      query: AuthChallengeQuery,
      variables: {},
      error: challengeError,
      fetchPolicy: 'network-only'
    });

    // Check challenge
    if (!data || !data.authChallenge) throw challengeError; // Should never occur

    // Check server signature
    const signatureOK = await this.cryptoService.verify(
      data.authChallenge.challenge,
      data.authChallenge.signature,
      data.authChallenge.pubkey
    );
    if (!signatureOK) {
      console.warn('FIXME: Bad peer signature on auth challenge !', data.authChallenge);
    }
    // TODO: check server pubkey as a valid certificate

    // Do the challenge
    const signature = await this.cryptoService.sign(data.authChallenge.challenge, this.data.keypair);
    const newToken = `${this.data.pubkey}:${data.authChallenge.challenge}|${signature}`;

    // iterate with the new token
    return await this.authenticateAndGetToken(newToken, (counter || 1) + 1 /* increment */);
  }

  /* -- Protected methods -- */

}
