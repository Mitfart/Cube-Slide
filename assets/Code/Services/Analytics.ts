import { _decorator } from 'cc';
const { ccclass } = _decorator;

type PlayableWindow = Window & {
    ALPlayableAnalytics?: {
        trackEvent?: (eventName: string) => void;
    };
    gameEnd?: () => void;
};

export class AnalyticEvents {
    static readonly LOADING = 'LOADING';
    static readonly LOADED = 'LOADED';
    static readonly DISPLAYED = 'DISPLAYED';
    static readonly CHALLENGE_STARTED = 'CHALLENGE_STARTED';
    static readonly CHALLENGE_FAILED = 'CHALLENGE_FAILED';
    static readonly CHALLENGE_RETRY = 'CHALLENGE_RETRY';
    static readonly CHALLENGE_PASS_25 = 'CHALLENGE_PASS_25';
    static readonly CHALLENGE_PASS_50 = 'CHALLENGE_PASS_50';
    static readonly CHALLENGE_PASS_75 = 'CHALLENGE_PASS_75';
    static readonly CHALLENGE_SOLVED = 'CHALLENGE_SOLVED';
    static readonly ENDCARD_SHOWN = 'ENDCARD_SHOWN';
    static readonly CTA_CLICKED = 'CTA_CLICKED';
}

@ccclass('Analytics')
export class Analytics {
    private static emitedEvents: Set<string> = new Set();
    

    public static emit(eventName: string) {
        if (this.emitedEvents.has(eventName)) {
            return;
        } else {
            this.emitedEvents.add(eventName);
        }

        const playable = window as PlayableWindow;

        if (typeof playable.ALPlayableAnalytics !== 'undefined' && typeof playable.ALPlayableAnalytics.trackEvent === 'function') {
            playable.ALPlayableAnalytics.trackEvent(eventName);
        }
        else if (typeof playable.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
            playable.dispatchEvent(new CustomEvent(eventName));
        }
        
        console.log(`[Analytics] ${eventName}`);
    }
}
