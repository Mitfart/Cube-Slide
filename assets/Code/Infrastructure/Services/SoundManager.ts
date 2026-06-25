import { _decorator, AudioClip, AudioSource, Component, input, Input, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SoundManager')
export class SoundManager extends Component {
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
    private soundSources = new Map<string, AudioSource>();
    private readonly missingClips = new Set<string>();

    protected onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this.unlock, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.unlock, this);
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
        this.playMusic();
    }

    private playMusic(): void {
        if (!this.music) {
            console.error('[SoundManager] Missing music');
            return;
        }
        
        this.musicSource ??= ((): AudioSource => {
            const soundNode = new Node(`Sound_Music`);
            soundNode.setParent(this.node);
            return soundNode.addComponent(AudioSource);
        })();

        this.musicSource.clip = this.music;
        this.musicSource.loop = true;
        this.musicSource.volume = this.musicVolume;
        this.musicSource.play();
    }

    private playAt(name: string, clip: AudioClip | null, worldPosition: Vec3): void {
        if (!this.canPlay(name, clip)) {
            return;
        }

        this.soundSources.set(name, this.soundSources.get(name) ?? (() => {
            const soundNode = new Node(`Sound_${name}`);
            
            soundNode.setParent(this.node);
            soundNode.setWorldPosition(worldPosition);

            return soundNode.addComponent(AudioSource);
        })());
        const source = this.soundSources.get(name)

        source.clip = clip;
        source.volume = this.sfxVolume;
        source.play();
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
