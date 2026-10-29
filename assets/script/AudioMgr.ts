import { _decorator, Component, AudioClip, AudioSource, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 音频总控 —— 单例，全局随便调
 *
 * 用法：
 *   1. 在 Canvas 下建个空节点叫 Audio，挂上本脚本 + AudioSource 组件
 *   2. 把 sound 目录里的音频拖到对应槽位
 *   3. 代码里直接 AudioMgr.I?.shoot() / enemyHit() / enemyDeath() / hit() / playerDeath() / pickup() / heal()
 *
 * 注意：音效走 playOneShot（可叠加），BGM 走 play（会打断），两者都用同一个 AudioSource。
 */
@ccclass('AudioMgr')
export class AudioMgr extends Component {
    static I: AudioMgr = null;

    @property(AudioClip) clipShoot: AudioClip = null;
    @property(AudioClip) clipEnemyDeath: AudioClip = null;
    @property(AudioClip) clipEnemyHit: AudioClip = null;
    @property(AudioClip) clipPlayerHit: AudioClip = null;
    @property(AudioClip) clipPlayerDeath: AudioClip = null;
    @property(AudioClip) clipPickup: AudioClip = null;
    @property(AudioClip) clipHeal: AudioClip = null;
    @property(AudioClip) clipBgm: AudioClip = null;

    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true, tooltip: '音效总音量' })
    sfxVolume: number = 0.7;

    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true, tooltip: '背景音乐音量' })
    bgmVolume: number = 0.35;

    private _src: AudioSource = null;

    onLoad() {
        AudioMgr.I = this;
        this._src = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this._src.playOnAwake = false;
    }

    start() {
        this.playBgm();
    }

    onDestroy() {
        if (AudioMgr.I === this) AudioMgr.I = null;
    }

    private oneShot(clip: AudioClip, scale: number = 1) {
        if (!clip || !this._src) return;
        this._src.playOneShot(clip, this.sfxVolume * scale);
    }

    /** 开火：一秒可能好几发，音量压一点，别吵 */
    shoot() { this.oneShot(this.clipShoot, 0.55); }

    /** 敌机爆炸 */
    enemyDeath() { this.oneShot(this.clipEnemyDeath, 0.9); }

    /** 敌机中弹但没死：会响得很密，音量压低 */
    enemyHit() { this.oneShot(this.clipEnemyHit, 0.45); }

    /** 玩家受击 */
    hit() { this.oneShot(this.clipPlayerHit, 1.0); }

    /** 玩家阵亡：爆炸 + 电源衰竭，长度对齐 player-death 动画（约 0.75s） */
    playerDeath() { this.oneShot(this.clipPlayerDeath, 1.0); }

    /** 吃到道具 */
    pickup() { this.oneShot(this.clipPickup, 0.8); }

    /** 回血：上行琶音，比拾取更温暖 */
    heal() { this.oneShot(this.clipHeal, 0.85); }

    /** 循环播放 BGM */
    playBgm() {
        if (!this.clipBgm || !this._src) return;
        this._src.clip = this.clipBgm;
        this._src.loop = true;
        this._src.volume = this.bgmVolume;
        this._src.play();
    }

    stopBgm() {
        if (this._src) this._src.stop();
    }
}
