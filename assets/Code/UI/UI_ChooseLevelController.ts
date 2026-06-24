import { _decorator, Component, Layers, Layout, Node, Size, SpriteFrame, UITransform, view } from 'cc';
import { UI_Screen } from '../../Cocos_Engine/General/Code/ui/UI_Screen';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
import { UI_ChooseLevelCard } from './UI_ChooseLevelCard';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelController')
export class UI_ChooseLevelController extends Component {
    @property(Layout)
    public cardsLayout: Layout | null = null;

    @property([UI_ChooseLevelCard])
    public levelCards: UI_ChooseLevelCard[] = [];

    @property(SpriteFrame)
    public endTitleWin: SpriteFrame | null = null;

    @property(SpriteFrame)
    public endTitleFail: SpriteFrame | null = null;

    @property(UI_Screen)
    public screen: UI_Screen | null = null;

    private readonly levelResults: (boolean | null)[] = [];
    private gameManager: { buildLevel(level: LevelConfig): void } | null = null;

    protected onLoad(): void {
        this.setLayerRecursively(this.node, Layers.Enum.UI_2D);
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursively(child, layer);
        }
    }

    public setGameManager(gameManager: { buildLevel(level: LevelConfig): void }): void {
        this.gameManager = gameManager;
    }

    protected onEnable(): void {
        const cards = this.getCards();
        for (let i = 0; i < cards.length; i++) {
            cards[i]?.initialize(i, index => this.chooseLevel(index));
        }

        const grid = this.cardsLayout;
        view.on('canvas-resize', this.updateCardsLayout, this);
        grid?.node.on(UITransform.EventType.SIZE_CHANGED, this.updateCardsLayout, this);
        this.updateCardsLayout();
    }

    protected onDisable(): void {
        for (const card of this.getCards()) {
            card?.deinitialize();
        }

        const grid = this.cardsLayout;
        view.off('canvas-resize', this.updateCardsLayout, this);
        grid?.node.off(UITransform.EventType.SIZE_CHANGED, this.updateCardsLayout, this);
    }

    public show(onComplete: () => void): void {
        for (const card of this.getCards()) {
            card?.normalize();
        }
        this.screen?.show(() => { 
            this.updateResultCards(true); 
            onComplete?.(); 
        });
    }

    public hide(onComplete: () => void = null): void {
        this.screen?.hide(false, onComplete);
    }

    public setLevelResult(index: number, won: boolean): void {
        this.levelResults[index] = won;
    }

    private updateCardsLayout(): void {
        const gridLayout = this.cardsLayout;
        if (!gridLayout) {
            console.error('[UI_ChooseLevelController] Missing cardsLayout');
            return;
        }

        const transform = gridLayout.node.getComponent(UITransform);
        if (!transform) {
            console.error('[UI_ChooseLevelController] Missing UITransform on cardsLayout');
            return;
        }

        const count = this.getCards().filter(Boolean).length;
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

    private updateResultCards(animated: boolean): void {
        const cards = this.getCards();
        for (let i = 0; i < cards.length; i++) {
            this.updateResultCard(cards[i], this.levelResults[i], animated);
        }
    }

    private updateResultCard(card: UI_ChooseLevelCard | null, won: boolean | null, animated: boolean): void {
        if (!card) return;

        if (won === null || won === undefined) {
            card.hideResult();
            return;
        }

        const spriteFrame = won ? this.endTitleWin : this.endTitleFail;
        if (!spriteFrame) {
            console.error('[UI_ChooseLevelController] Missing end title SpriteFrame');
            return;
        }

        card.showResult(spriteFrame, animated);
    }

    private getCards(): (UI_ChooseLevelCard | null)[] {
        return this.levelCards;
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

        this.gameManager.buildLevel(level);
        this.hide();
    }
}
