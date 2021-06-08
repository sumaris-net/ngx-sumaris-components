export declare type HammerSwipeAction = 'swipeleft' | 'swiperight';
export declare type HammerSwipeEvent = UIEvent & {
  type: HammerSwipeAction;
  pointerType: 'touch' | any;
  center: {x: number; y: number };
  distance: number;
  velocity: number;
  srcEvent: UIEvent;
};

export declare type HammerTapEvent = UIEvent & {
  tapCount: number;
  srcEvent: UIEvent;
};
