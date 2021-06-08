import {Injectable, Pipe, PipeTransform} from '@angular/core';
import {Account, accountToString} from '../model/account.model';

@Pipe({
  name: 'isLogin'
})
@Injectable({providedIn: 'root'})
export class IsLoginAccountPipe implements PipeTransform {

  transform(value: Account): boolean {
    return value && value.pubkey && true;
  }
}

@Pipe({
  name: 'accountToString'
})
@Injectable({providedIn: 'root'})
export class AccountToStringPipe implements PipeTransform {

  transform(value: Account): string {
    return accountToString(value);
  }
}

