type SideOrAngle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
type SideOrAngleOrCenter = SideOrAngle | 'center';

interface DeckCounter {
    /**
     * Show a card counter on the deck. Default true.
     */
    show?: boolean;

    /**
     * Counter position. Default 'bottom'.
     */
    position?: SideOrAngleOrCenter;

    /**
     * Classes to add to counter (separated with spaces). Pre-built are `round` and `text-shadow`. Default `round`.
     */
    extraClasses?: string;

    /**
     * Show the counter when empty. Default true.
     */
    hideWhenEmpty?: boolean;

    /**
     * Set a counter id if you want to set a tooltip on it, for example. Default unset.
     */
    counterId?: string;
}

interface DeckSettings<T> {
    /**
     * Indicate the current top card.
     */
    topCard?: T;

    /**
     * Indicate the current number of cards in the deck (default 52).
     */
    cardNumber?: number;

    /**
     * Indicate if the card count is automatically updated when a card is added or removed.
     */
    autoUpdateCardNumber?: boolean;

    /**
     * Indicate if the cards under the new top card must be removed (to forbid players to check the content of the deck with Inspect). Default true.
     */
    autoRemovePreviousCards?: boolean;

    /**
     * Indicate the thresholds to add 1px to the thickness of the pile. Default [0, 2, 5, 10, 20, 30].
     */
    thicknesses?: number[];

    /**
     * Shadow direction. Default 'bottom-right'.
     */
    shadowDirection?: SideOrAngle;

    /**
     * Show a card counter on the deck. Not visible if unset.
     */
    counter?: DeckCounter;

    /**
     * A generator of fake cards, to generate decks top card automatically.
     * Default is manager `fakeCardGenerator` method.
     * 
     * @param deckId the deck id
     * @return the fake card to be generated (usually, only informations to show back side)
     */
    fakeCardGenerator?: (deckId: string) => T;
}

interface AddCardToDeckSettings extends AddCardSettings {
    /**
     * Indicate if the card count is automatically updated when a card is added or removed. Default true.
     */
    autoUpdateCardNumber?: boolean;

    /**
     * Indicate if the cards under the new top card must be removed (to forbid players to check the content of the deck with Inspect). Default true.
     */
    autoRemovePreviousCards?: boolean;
}

interface RemoveCardFromDeckSettings extends RemoveCardSettings {
    /**
     * Indicate if the card count is automatically updated when a card is added or removed.
     */
    autoUpdateCardNumber?: boolean;
}

class SlideAndBackAnimation<T> extends BgaCumulatedAnimation<BgaCumulatedAnimationsSettings> {
    constructor(manager: CardManager<T>, element: HTMLElement, tempElement: boolean) {
        const distance = (manager.getCardWidth() + manager.getCardHeight()) / 2;
        const angle = Math.random() * Math.PI * 2;
        const fromDelta = {
            x: distance * Math.cos(angle),
            y: distance * Math.sin(angle),
        }

        super({
            animations: [
                new BgaSlideToAnimation({ element, fromDelta, duration: 250 } as BgaAnimationWithOriginSettings),
                new BgaSlideAnimation({ element, fromDelta, duration: 250, animationEnd: tempElement ? (() => element.remove()) : undefined } as BgaAnimationWithOriginSettings),
            ]
        });
    }
}

/**
 * Abstract stock to represent a deck. (pile of cards, with a fake 3d effect of thickness). * 
 * Needs cardWidth and cardHeight to be set in the card manager.
 */
class Deck<T> extends CardStock<T> {
    protected cardNumber: number;
    protected autoUpdateCardNumber: boolean;
    protected autoRemovePreviousCards: boolean;
    protected fakeCardGenerator?: (deckId: string) => T;
    protected thicknesses: number[];

    constructor(protected manager: CardManager<T>, protected element: HTMLElement, settings: DeckSettings<T>) {
        super(manager, element);
        
        element.classList.add('deck');
        const cardWidth = this.manager.getCardWidth();
        const cardHeight = this.manager.getCardHeight();
        if (cardWidth && cardHeight) {
            this.element.style.setProperty('--width', `${cardWidth}px`);
            this.element.style.setProperty('--height', `${cardHeight}px`);
        } else {
            throw new Error(`You need to set cardWidth and cardHeight in the card manager to use Deck.`);
        }
        this.fakeCardGenerator = settings?.fakeCardGenerator ?? manager.getFakeCardGenerator();
        this.thicknesses = settings.thicknesses ?? [0, 2, 5, 10, 20, 30];
        this.setCardNumber(settings.cardNumber ?? 52);
        this.autoUpdateCardNumber = settings.autoUpdateCardNumber ?? true;
        this.autoRemovePreviousCards = settings.autoRemovePreviousCards ?? true;

        const shadowDirection = settings.shadowDirection ?? 'bottom-right';
        const shadowDirectionSplit = shadowDirection.split('-');
        const xShadowShift = shadowDirectionSplit.includes('right') ? 1 : (shadowDirectionSplit.includes('left') ? -1 : 0);
        const yShadowShift = shadowDirectionSplit.includes('bottom') ? 1 : (shadowDirectionSplit.includes('top') ? -1 : 0);
        this.element.style.setProperty('--xShadowShift', ''+xShadowShift);
        this.element.style.setProperty('--yShadowShift', ''+yShadowShift);

        if (settings.topCard) {
            this.addCard(settings.topCard);
        } else if (settings.cardNumber > 0) {
            this.addCard(this.getFakeCard());
        }

        if (settings.counter && (settings.counter.show ?? true)) {
            if (settings.cardNumber === null || settings.cardNumber === undefined) {
                throw new Error(`You need to set cardNumber if you want to show the counter`);
            } else {
                this.createCounter(settings.counter.position ?? 'bottom', settings.counter.extraClasses ?? 'round', settings.counter.counterId);

                if (settings.counter?.hideWhenEmpty) {
                    this.element.querySelector('.bga-cards_deck-counter').classList.add('hide-when-empty');
                }
            }
        }
        
        this.setCardNumber(settings.cardNumber ?? 52);
    }

    protected createCounter(counterPosition: SideOrAngleOrCenter, extraClasses: string, counterId?: string) {
        const left = counterPosition.includes('right') ? 100 : (counterPosition.includes('left') ? 0 : 50);
        const top = counterPosition.includes('bottom') ? 100 : (counterPosition.includes('top') ? 0 : 50);
        this.element.style.setProperty('--bga-cards-deck-left', `${left}%`);
        this.element.style.setProperty('--bga-cards-deck-top', `${top}%`);

        this.element.insertAdjacentHTML('beforeend', `
            <div ${counterId ? `id="${counterId}"` : ''} class="bga-cards_deck-counter ${extraClasses}"></div>
        `);
    }

    /**
     * Get the the cards number.
     * 
     * @returns the cards number
     */
    public getCardNumber() {
        return this.cardNumber;
    }

    /**
     * Set the the cards number.
     * 
     * @param cardNumber the cards number
     * @param topCard the deck top card. If unset, will generated a fake card (default). Set it to null to not generate a new topCard.
     */
    public setCardNumber(cardNumber: number, topCard: T | null | undefined = undefined): Promise<boolean> {
        const promise = topCard === null || cardNumber == 0 ? 
            Promise.resolve(false) : 
            super.addCard(topCard || this.getFakeCard(), undefined, <AddCardToDeckSettings>{ autoUpdateCardNumber: false });

        this.cardNumber = cardNumber;

        this.element.dataset.empty = (this.cardNumber == 0).toString();

        let thickness = 0;
        this.thicknesses.forEach((threshold, index) => {
            if (this.cardNumber >= threshold) {
                thickness = index;
            }
        });
        this.element.style.setProperty('--thickness', `${thickness}px`);

        const counterDiv = this.element.querySelector('.bga-cards_deck-counter');
        if (counterDiv) {
            counterDiv.innerHTML = `${cardNumber}`;
        }

        return promise;
    }

    public addCard(card: T, animation?: CardAnimation<T>, settings?: AddCardToDeckSettings): Promise<boolean> {
        if (settings?.autoUpdateCardNumber ?? this.autoUpdateCardNumber) {
            this.setCardNumber(this.cardNumber + 1, null);
        }

        const promise = super.addCard(card, animation, settings);

        if (settings?.autoRemovePreviousCards ?? this.autoRemovePreviousCards) {
            promise.then(() => {
                const previousCards = this.getCards().slice(0, -1); // remove last cards
                this.removeCards(previousCards, { autoUpdateCardNumber: false });
            });
        }

        return promise;
    }

    public cardRemoved(card: T, settings?: RemoveCardFromDeckSettings) {
        if (settings?.autoUpdateCardNumber ?? this.autoUpdateCardNumber) {
            this.setCardNumber(this.cardNumber - 1);
        }
        super.cardRemoved(card, settings);
    }

    public getTopCard(): T | null {
        const cards = this.getCards();
        return cards.length ? cards[cards.length - 1] : null;
    }

    /**
     * Shows a shuffle animation on the deck
     * 
     * @param animatedCardsMax number of animated cards for shuffle animation.
     * @param fakeCardSetter a function to generate a fake card for animation. Required if the card id is not based on a numerci `id` field, or if you want to set custom card back
     * @returns promise when animation ends
     */
    public async shuffle(animatedCardsMax: number = 10, fakeCardSetter?: (card: T, index: number) => void, newTopCard?: T): Promise<boolean> {
        this.addCard(newTopCard ?? this.getFakeCard(), undefined, { autoUpdateCardNumber: false });

        if (!this.manager.animationsActive()) { 
            return Promise.resolve(false); // we don't execute as it's just visual temporary stuff
        }

        const animatedCards = Math.min(10, animatedCardsMax, this.getCardNumber());

        if (animatedCards > 1) {
            const elements = [this.getCardElement(this.getTopCard())];
            for (let i = elements.length; i <= animatedCards; i++) {
                let newCard: T;
                if (fakeCardSetter) {
                    newCard = {} as T;
                    fakeCardSetter(newCard, i);
                } else {
                    newCard = this.fakeCardGenerator(`${this.element.id}-shuffle-${i}`);
                }
                const newElement = this.manager.createCardElement(newCard, false);
                newElement.dataset.tempCardForShuffleAnimation = 'true';
                this.element.prepend(newElement);
                elements.push(newElement);
            }
            await this.manager.animationManager.playWithDelay(elements.map(element => new SlideAndBackAnimation(this.manager, element, element.dataset.tempCardForShuffleAnimation == 'true')), 50);

            return true;
        } else {
            return Promise.resolve(false);
        }
    }

    protected getFakeCard(): T {
        return this.fakeCardGenerator(this.element.id);
    }
}