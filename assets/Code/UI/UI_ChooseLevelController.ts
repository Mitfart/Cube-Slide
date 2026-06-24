import { _decorator, Component, EventTouch, Layers, Node } from 'cc';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelController')
export class UI_ChooseLevelController extends Component {
    @property(Node)
    public gameManager: Node | null = null;

    @property([Node])
    public cards: Node[] = [];

    protected onLoad(): void {
        this.setLayerRecursively(this.node, Layers.Enum.UI_2D);
    }

    protected onEnable(): void {
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            card.on(Node.EventType.TOUCH_END, this.onCardTouch, this);
        }
    }

    protected onDisable(): void {
        for (const card of this.cards) {
            if (!card) continue;
            card.off(Node.EventType.TOUCH_END, this.onCardTouch, this);
        }
    }

    public show(): void {
        this.node.active = true;
    }

    public hide(): void {
        this.node.active = false;
    }

    private onCardTouch(event: EventTouch): void {
        const index = this.cards.indexOf(event.target as Node);
        if (index < 0) {
            return;
        }
        this.chooseLevel(index);
    }

    private chooseLevel(index: number): void {
        if (!this.gameManager) {
            console.error('[UI_ChooseLevelController] Missing gameManager');
            return;
        }
        const level = LEVELS[index];
        if (!level) {
            console.error('[UI_ChooseLevelController] Missing level');
            return;
        }

        this.hide();
        const gameManager = this.gameManager.getComponent('GameManager') as { buildLevel(level: LevelConfig): void } | null;
        if (!gameManager) {
            console.error('[UI_ChooseLevelController] Missing GameManager component');
            return;
        }
        gameManager.buildLevel(level);
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursively(child, layer);
        }
    }
}
