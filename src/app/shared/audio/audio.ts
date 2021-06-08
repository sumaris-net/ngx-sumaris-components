import {Injectable, Optional} from '@angular/core';
import {NativeAudio} from '@ionic-native/native-audio/ngx';
import {Vibration} from '@ionic-native/vibration/ngx';
import {Platform} from '@ionic/angular';
import {AudioManagement} from '@ionic-native/audio-management/ngx';
import {Subject} from 'rxjs';
import {isNil, toBoolean} from '../functions';

export type AudioType = 'html5' | 'native';
export interface Sound {
  id: string;
  assetPath: string;
  vibration?: number|number[];
}

const SYSTEM_SOUNDS: Sound[] = [
  {id: 'beep-confirm', assetPath: 'assets/audio/beep-confirm.mp3', vibration: 250},
  {id: 'beep-error', assetPath: 'assets/audio/beep-error.mp3', vibration: 1000},
  {id: 'startup', assetPath: 'assets/audio/unfa-ping.mp3', vibration: [1, 500, 250, 750]},
];

@Injectable({providedIn: 'root'})
export class AudioProvider {

  private _started = false;
  private _startPromise: Promise<void>;

  private _audioType: AudioType;
  private _audioMode: AudioManagement.AudioMode = AudioManagement.AudioMode.NORMAL;

  private _preloadedSounds: {[id: string]: Sound} = {};
  private _htmlAudioCache: {[id: string]: HTMLAudioElement} = {};

  public onStart = new Subject<void>();

  constructor(
    private platform: Platform,
    @Optional() private nativeAudio: NativeAudio,
    @Optional() private vibration: Vibration,
    @Optional() private audioManagement: AudioManagement
  ) {

    this.start();
  }

  public async ready() {
    if (this._started) return Promise.resolve();
    await this.start();
  }

  playBeepConfirm(): Promise<any> {
    return this.play('beep-confirm', {
      // Vibrate only if in vibration mode
      vibrate: this._audioMode === AudioManagement.AudioMode.VIBRATE
    });
  }

  playBeepError(): Promise<any> {
    return this.play('beep-error', {
      // Vibrate only if in vibration mode
      vibrate: true
    });
  }

  async playStartupSound(): Promise<any> {
    return this.play('startup');
  }

  async preload(sound: Sound) {
    if (isNil(this._audioType)) await this.ready();

    if (this._audioType === 'native') {
      console.info(`[audio] Preloading audio file '${sound.assetPath}'...`);
      try {
        await this.nativeAudio.preloadSimple(sound.id, sound.assetPath);
        console.info(`[audio] Preloading audio file '${sound.assetPath}' [OK]`);
      }
      catch (err) {
        console.error(`[audio] Unable to preload audio file '${sound.assetPath}': ${err && err.message || err}`, err);
      }
    }
    else {
      this._htmlAudioCache[sound.id] =  new Audio(sound.assetPath);
    }

    // Add to map
    this._preloadedSounds[sound.id] = sound;
  }

  async play(id: string, opts?: {vibrate?: boolean; vibrationTimes?: number|number[]}) {

    // Make sure provider is ready
    if (!this._started) await this.ready();

    const sound = this._preloadedSounds[id];
    if (!sound) {
      throw Error('Unable to find audio with id: ' + id + '. Please call preload() before playing a sound.');
    }

    // If silent: skip
    if (this._audioMode === AudioManagement.AudioMode.SILENT) return;

    const promises: Promise<any>[] = [];

    // Normal mode = can play the sound
    if (this._audioMode === AudioManagement.AudioMode.NORMAL) {
      // Use native audio
      if (this._audioType === 'native') {
        promises.push(this.nativeAudio.play(sound.id));
      }
      // Or HTML 5 audio
      else {
        const audio = this._htmlAudioCache[id] || new Audio(sound.assetPath);
        promises.push(audio.play());
      }
    }

    // Vibrate mode: by default make vibration is enable
    else if (isNil(sound.vibration) && isNil(opts && opts.vibrate)) {
      opts = opts || {};
      opts.vibrate = true;
    }

    // Do vibration (if sound as default vibration, or if user ask for it)
    if (toBoolean(opts && opts.vibrate, !!sound.vibration)) {
      promises.push(this.vibrate(opts && opts.vibrationTimes || sound.vibration));
    }

    return (promises.length === 1 ? promises[0] : Promise.all(promises))
      .catch(err => {
        console.error(`[audio] Error while playing audio sound '${id}': ${err && err.message || err}`, err);
      });
  }

  async unload(id: string) {
    if (isNil(this._audioType)) await this.ready();

    // Remove from map
    this._preloadedSounds[id] = undefined;

    // Native unload
    if (this._audioType === 'native') {
      try {
        await this.nativeAudio.unload(id);
      }
      catch (err) {
        console.error(`[audio] Unable to unload audio '${id}': ${err && err.message || err}`, err);
      }
    }
    // HTML5 audio unload
    else {
      this._htmlAudioCache[id].remove();
      this._htmlAudioCache[id] = undefined;
    }
  }

  async vibrate(timeInMs?: number|number[]) {
    if (!this._started) await this.ready();

    if (!this.vibration) return; // Skip if vibrate plugin

    this.vibration.vibrate(timeInMs || 250);
  }

  /* -- protected methods  -- */

  start() {
    if (this._startPromise) return this._startPromise;
    if (this._started) return Promise.resolve();

    let cordova: boolean;
    this._startPromise = this.platform.ready()
      .then(async () => {
        cordova = this.platform.is('cordova');
        this._audioType = cordova && this.nativeAudio ? 'native' : 'html5';
        console.info(`[audio] Starting audio provider {${this._audioType}}...`);

        // Listen audio mode changed
        if (cordova && this.audioManagement) {
          await this.readAudioMode();
        }
      })

      // Pre-loading system sounds
      .then(() => {
        console.debug('[audio] Preloading audio sounds...');
        return Promise.all(SYSTEM_SOUNDS.map(s => {
          // Disable vibration is cordova not enabled
          if (!cordova) s.vibration = undefined;
          return this.preload(s);
        }));
      })

      .then(() => {
        this._started = true;
        this._startPromise = null;

        console.info('[audio] Audio provider started');

        // Emit event
        this.onStart.next();
      })
      .catch(err => {
        console.error('[audio] Unable to start audio provider: ' + (err && err.message || err), err);
        this._started = false;
        this._startPromise = null;
      });

    return this._startPromise;
  }

  protected async readAudioMode() {
    const value = await this.audioManagement.getAudioMode();
    this._audioMode = value && value.audioMode || AudioManagement.AudioMode.NORMAL;
    console.debug(`[audio] Detected device audio mode {${value.label}} (${this._audioMode})`);
  }

}
