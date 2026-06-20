import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { UI_Screen } from '../../Cocos_Engine/General/Code/ui/UI_Screen';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property({ type: Prefab })
    public winScreenPrefab: Prefab | null = null;

    @property({ type: Prefab })
    public failScreenPrefab: Prefab | null = null;

    @property({ type: Prefab })
    public confettiEffectPrefab: Prefab | null = null;

    private endScreen: UI_Screen | null = null;
    private confettiEffect: Node | null = null;

    public reset(): void {
        if (this.endScreen) {
            this.endScreen.node.destroy();
            this.endScreen = null;
        }
        if (this.confettiEffect) {
            this.confettiEffect.destroy();
            this.confettiEffect = null;
        }
    }

    public showWin(): void {
        this.showEndScreen(this.winScreenPrefab, 'winScreenPrefab');
        this.playConfettiEffect();
    }

    public showFail(): void {
        this.showEndScreen(this.failScreenPrefab, 'failScreenPrefab');
    }

    private showEndScreen(prefab: Prefab | null, fieldName: string): void {
        this.reset();
        if (!prefab) {
            console.error(`[UIManager] Missing ${fieldName}`);
            return;
        }

        const screenNode = instantiate(prefab);
        screenNode.setParent(this.node);
        this.endScreen = screenNode.getComponent(UI_Screen);
        if (!this.endScreen) {
            console.error(`[UIManager] Missing UI_Screen on ${fieldName}`);
            screenNode.destroy();
            return;
        }
        this.endScreen.show();
    }

    private playConfettiEffect(): void {
        if (!this.confettiEffectPrefab) {
            console.error('[UIManager] Missing confettiEffectPrefab');
            return;
        }

        this.confettiEffect = instantiate(this.confettiEffectPrefab);
        this.confettiEffect.setParent(this.node);
        this.confettiEffect.setPosition(0, 0, 0);
        this.confettiEffect.setScale(new Vec3(5, 5, 5));
    }

}
