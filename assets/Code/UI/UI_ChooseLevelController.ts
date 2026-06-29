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

    public show(onComplete: () => void = null): void {
        for (const card of this.getCards()) {
            card?.normalize();
        }
        this.updateCardsLayout();
        this.screen?.show(() => { 
            this.updateCardsLayout();
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

    public blockInput() {
        this.getCards().forEach(card => {
            card.block();
        });
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
        let cardHeight = 0;
        const cardAspect = this.getCardAspect();
        const constraint = gridLayout.constraint;
        const constraintNum = Math.max(1, gridLayout.constraintNum);
        const getCardHeight = (columnCount: number, rowCount: number): number => Math.min(
            (containerWidth - spacingX * (columnCount - 1)) / columnCount / cardAspect,
            (containerHeight - spacingY * (rowCount - 1)) / rowCount,
        );

        if (constraint === Layout.Constraint.FIXED_COL) {
            columns = Math.min(count, constraintNum);
            rows = Math.ceil(count / columns);
            cardHeight = getCardHeight(columns, rows);
        } else if (constraint === Layout.Constraint.FIXED_ROW) {
            rows = Math.min(count, constraintNum);
            columns = Math.ceil(count / rows);
            cardHeight = getCardHeight(columns, rows);
        } else {
            for (let candidateColumns = 1; candidateColumns <= count; candidateColumns++) {
                const candidateRows = Math.ceil(count / candidateColumns);
                const candidateCardHeight = getCardHeight(candidateColumns, candidateRows);

                if (candidateCardHeight > cardHeight) {
                    columns = candidateColumns;
                    rows = candidateRows;
                    cardHeight = candidateCardHeight;
                }
            }
        }

        cardHeight = Math.max(0, cardHeight);
        const cardWidth = cardHeight * cardAspect;
        const usedWidth = columns * cardWidth + spacingX * (columns - 1);
        const usedHeight = rows * cardHeight + spacingY * (rows - 1);

        gridLayout.type = Layout.Type.GRID;
        gridLayout.resizeMode = Layout.ResizeMode.CHILDREN;
        gridLayout.constraint = constraint === Layout.Constraint.FIXED_ROW ? Layout.Constraint.FIXED_ROW : Layout.Constraint.FIXED_COL;
        gridLayout.constraintNum = constraint === Layout.Constraint.FIXED_ROW ? rows : columns;
        gridLayout.cellSize = new Size(cardWidth, cardHeight);
        gridLayout.paddingLeft = (containerWidth - usedWidth) * 0.5;
        gridLayout.paddingRight = gridLayout.paddingLeft;
        gridLayout.paddingTop = (containerHeight - usedHeight) * 0.5;
        gridLayout.paddingBottom = gridLayout.paddingTop;
        gridLayout.updateLayout(true);
    }

    private getCardAspect(): number {
        const card = this.getCards().find(Boolean);
        const size = card?.node.getComponent(UITransform)?.contentSize;
        if (!size || size.height <= 0) return 1;

        return size.width / size.height;
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
