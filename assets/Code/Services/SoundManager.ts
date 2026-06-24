import { _decorator, AudioClip, AudioSource, Component, input, Input, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SoundManager')
export class SoundManager extends Component {
    public static current: SoundManager | null = null;

    @property(AudioClip)
    public music: AudioClip | null = null;

    @property(AudioClip)
    public uiClick: AudioClip | null = null;

    @property(AudioClip)
    public coin: AudioClip | null = null;

    @property(AudioClip)
    public cellTrail: AudioClip | null = null;

    @property(AudioClip)
    public cellsFillStart: AudioClip | null = null;

    @property(AudioClip)
    public enemyHit: AudioClip | null = null;

    @property(AudioClip)
    public enemyDestroy: AudioClip | null = null;

    @property(AudioClip)
    public win: AudioClip | null = null;

    @property
    public musicVolume = 0.35;

    @property
    public sfxVolume = 1;

    private unlocked = false;
    private musicSource: AudioSource | null = null;
    private readonly missingClips = new Set<string>();

    protected onEnable(): void {
        SoundManager.current = this;
        input.on(Input.EventType.TOUCH_START, this.unlock, this);
    }

    protected onDisable(): void {
        if (SoundManager.current === this) {
            SoundManager.current = null;
        }
        input.off(Input.EventType.TOUCH_START, this.unlock, this);
        this.musicSource?.stop();
    }

    public playUiClick(position: Vec3): void {
        this.playAt('uiClick', this.uiClick, position);
    }

    public playCoin(position: Vec3): void {
        this.playAt('coin', this.coin, position);
    }

    public playCellTrail(position: Vec3): void {
        this.playAt('cellTrail', this.cellTrail, position);
    }

    public playCellsFillStart(position: Vec3): void {
        this.playAt('cellsFillStart', this.cellsFillStart, position);
    }

    public playEnemyHit(position: Vec3): void {
        this.playAt('enemyHit', this.enemyHit, position);
    }

    public playEnemyDestroy(position: Vec3): void {
        this.playAt('enemyDestroy', this.enemyDestroy, position);
    }

    public playWin(position: Vec3): void {
        this.playAt('win', this.win, position);
    }

    private unlock(): void {
        if (this.unlocked) {
            return;
        }

        this.unlocked = true;
        this.musicSource = this.node.addComponent(AudioSource);
        this.playUiClick(this.node.worldPosition);
        this.playMusic();
    }

    private playMusic(): void {
        if (!this.music || !this.musicSource) {
            console.error('[SoundManager] Missing music');
            return;
        }

        this.musicSource.clip = this.music;
        this.musicSource.loop = true;
        this.musicSource.volume = this.musicVolume;
        this.musicSource.play();
    }

    private playAt(name: string, clip: AudioClip | null, worldPosition: Vec3): void {
        if (!this.canPlay(name, clip)) {
            return;
        }

        const soundNode = new Node(`Sound_${name}`);
        soundNode.setParent(this.node);
        soundNode.setWorldPosition(worldPosition);
        const source = soundNode.addComponent(AudioSource);
        source.clip = clip;
        source.volume = this.sfxVolume;
        source.play();
        this.scheduleOnce(() => soundNode.destroy(), Math.max(0.1, clip!.getDuration()));
    }

    private canPlay(name: string, clip: AudioClip | null): boolean {
        if (!this.unlocked) {
            return false;
        }
        if (!clip) {
            if (!this.missingClips.has(name)) {
                this.missingClips.add(name);
                console.error(`[SoundManager] Missing ${name}`);
            }
            return false;
        }
        return true;
    }
}
