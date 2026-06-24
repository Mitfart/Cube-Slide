import { _decorator, Component, EventTouch, Layers, Layout, Node, Size, Sprite, SpriteFrame, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { UI_Screen } from '../../Cocos_Engine/General/Code/ui/UI_Screen';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelController')
export class UI_ChooseLevelController extends Component {
    @property(Node)
    public gameManager: Node | null = null;

    @property([Node])
    public cards: Node[] = [];

    @property(SpriteFrame)
    public endTitleWin: SpriteFrame | null = null;

    @property(SpriteFrame)
    public endTitleFail: SpriteFrame | null = null;

    private readonly levelResults: (boolean | null)[] = [];

    protected onLoad(): void {
        this.setLayerRecursively(this.node, Layers.Enum.UI_2D);
    }

    protected onEnable(): void {
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            card.on(Node.EventType.TOUCH_END, this.onCardTouch, this);
        }

        const grid = this.getCardsLayout();
        view.on('canvas-resize', this.updateCardsLayout, this);
        grid?.node.on(UITransform.EventType.SIZE_CHANGED, this.updateCardsLayout, this);
        this.updateCardsLayout();
    }

    protected onDisable(): void {
        for (const card of this.cards) {
            if (!card) continue;
            card.off(Node.EventType.TOUCH_END, this.onCardTouch, this);
        }

        const grid = this.getCardsLayout();
        view.off('canvas-resize', this.updateCardsLayout, this);
        grid?.node.off(UITransform.EventType.SIZE_CHANGED, this.updateCardsLayout, this);
    }

    public show(): void {
        const screen = this.getScreen();
        if (!screen) return;
        this.hideResultCards();
        screen.show(() => this.updateResultCards(true));
    }

    public hide(onComplete: () => void = null): void {
        const screen = this.getScreen();
        if (!screen) return;
        screen.hide(false, onComplete);
    }

    public setLevelResult(index: number, won: boolean): void {
        this.levelResults[index] = won;
    }

    private onCardTouch(event: EventTouch): void {
        const index = this.cards.indexOf(event.target as Node);
        if (index < 0) {
            return;
        }
        this.chooseLevel(index);
    }

    private updateCardsLayout(): void {
        const gridLayout = this.getCardsLayout();
        if (!gridLayout) {
            console.error('[UI_ChooseLevelController] Missing cards Layout');
            return;
        }

        const transform = gridLayout.node.getComponent(UITransform);
        if (!transform) {
            console.error('[UI_ChooseLevelController] Missing UITransform on cards Layout');
            return;
        }

        const count = this.cards.filter(Boolean).length;
        if (count === 0) return;

        const containerWidth = transform.contentSize.width;
        const containerHeight = transform.contentSize.height;
        const spacingX = gridLayout.spacingX;
        const spacingY = gridLayout.spacingY;
        let columns = 1;
        let rows = count;
        let cell = 0;

        for (let candidateColumns = 1; candidateColumns <= count; candidateColumns++) {
            const candidateRows = Math.ceil(count / candidateColumns);
            const availableWidth = containerWidth - spacingX * (candidateColumns - 1);
            const availableHeight = containerHeight - spacingY * (candidateRows - 1);
            const candidateCell = Math.min(availableWidth / candidateColumns, availableHeight / candidateRows);

            if (candidateCell > cell) {
                columns = candidateColumns;
                rows = candidateRows;
                cell = candidateCell;
            }
        }

        cell = Math.max(0, cell);
        const usedWidth = columns * cell + spacingX * (columns - 1);
        const usedHeight = rows * cell + spacingY * (rows - 1);

        gridLayout.type = Layout.Type.GRID;
        gridLayout.resizeMode = Layout.ResizeMode.CHILDREN;
        gridLayout.constraint = Layout.Constraint.FIXED_COL;
        gridLayout.constraintNum = columns;
        gridLayout.cellSize = new Size(cell, cell);
        gridLayout.paddingLeft = (containerWidth - usedWidth) * 0.5;
        gridLayout.paddingRight = gridLayout.paddingLeft;
        gridLayout.paddingTop = (containerHeight - usedHeight) * 0.5;
        gridLayout.paddingBottom = gridLayout.paddingTop;
        gridLayout.updateLayout(true);
    }

    private getCardsLayout(): Layout | null {
        return this.cards[0]?.parent?.getComponent(Layout) ?? null;
    }

    private hideResultCards(): void {
        for (const card of this.cards) {
            const cover = card?.getChildByName('Cover');
            const banner = card?.getChildByName('Banner');
            if (cover) cover.active = false;
            if (banner) banner.active = false;
        }
    }

    private updateResultCards(animated: boolean): void {
        for (let i = 0; i < this.cards.length; i++) {
            this.updateResultCard(this.cards[i], this.levelResults[i], animated);
        }
    }

    private updateResultCard(card: Node | null, won: boolean | null, animated: boolean): void {
        if (!card) return;

        const cover = card.getChildByName('Cover');
        const banner = card.getChildByName('Banner');
        if (!cover) {
            console.error('[UI_ChooseLevelController] Missing Cover');
            return;
        }
        if (!banner) {
            console.error('[UI_ChooseLevelController] Missing Banner');
            return;
        }

        if (won === null || won === undefined) {
            cover.active = false;
            banner.active = false;
            return;
        }

        const coverOpacity = cover.getComponent(UIOpacity) ?? cover.addComponent(UIOpacity);
        const bannerSprite = banner.getComponent(Sprite);
        const spriteFrame = won ? this.endTitleWin : this.endTitleFail;
        if (!bannerSprite) {
            console.error('[UI_ChooseLevelController] Missing Sprite on Banner');
            return;
        }
        if (!spriteFrame) {
            console.error('[UI_ChooseLevelController] Missing end title SpriteFrame');
            return;
        }

        cover.active = true;
        coverOpacity.opacity = 125;
        banner.active = true;
        bannerSprite.spriteFrame = spriteFrame;

        if (!animated) return;
        const targetScale = banner.scale.clone();
        banner.setScale(Vec3.ZERO);
        tween(banner)
            .to(0.25, { scale: targetScale }, { easing: 'backOut' })
            .start();
    }

    private chooseLevel(index: number): void {
        if (this.levelResults[index] !== null && this.levelResults[index] !== undefined) {
            return;
        }
        if (!this.gameManager) {
            console.error('[UI_ChooseLevelController] Missing gameManager');
            return;
        }
        const level = LEVELS[index];
        if (!level) {
            console.error('[UI_ChooseLevelController] Missing level');
            return;
        }

        const gameManager = this.gameManager.getComponent('GameManager') as { buildLevel(level: LevelConfig): void } | null;
        if (!gameManager) {
            console.error('[UI_ChooseLevelController] Missing GameManager component');
            return;
        }
        gameManager.buildLevel(level);
        this.hide();
    }

    private getScreen(): UI_Screen | null {
        const screen = this.getComponent(UI_Screen);
        if (!screen) {
            console.error('[UI_ChooseLevelController] Missing UI_Screen');
        }
        return screen;
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursively(child, layer);
        }
    }
}
